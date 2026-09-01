import { useCallback, useRef, useSyncExternalStore } from 'react';
import type {
  AppState, Block, BlockStatus, MealDay, MealSlot, MoneyEntry, MoneyKind, Task, Workspace,
} from './types';
import { addDaysStr, todayStr } from './date';

// Unchanged from the vanilla app on purpose: the rewrite reads the data that is
// already on the device rather than migrating it to a new key.
const STORAGE_KEY = 'personalOS.v1';
export const LAST_WORKSPACE_KEY = 'personalOS.lastWorkspace';

export const DEFAULT_LABELS = ['Important', 'Today', 'Tomorrow', 'Office', 'Personal'];

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'timetable', name: 'Timetable', icon: '🗓️', system: true, type: 'timetable' },
  { id: 'tasks', name: 'Tasks', icon: '✅', system: true, type: 'tasks' },
  { id: 'health', name: 'Health', icon: '❤️', system: true, type: 'tasks' },
  { id: 'cpdsa', name: 'CP / DSA', icon: '💻', system: true, type: 'tasks' },
  { id: 'skincare', name: 'Skincare', icon: '✨', system: true, type: 'tasks' },
  { id: 'gym', name: 'Gym', icon: '🏋️', system: true, type: 'tasks' },
  { id: 'adhoc', name: 'Adhoc', icon: '⚡', system: true, type: 'tasks' },
  { id: 'content', name: 'Content', icon: '📣', system: true, type: 'tasks' },
  { id: 'openings', name: 'Openings', icon: '💼', system: true, type: 'tasks' },
  { id: 'finance', name: 'Finance', icon: '💰', system: true, type: 'finance' },
  { id: 'meals', name: 'Meals', icon: '🍳', system: true, type: 'meals' },
  { id: 'stats', name: 'Stats', icon: '📊', system: true, type: 'stats' },
];

/**
 * Four priority tiers with the meaning spelled out, because "high" on its own
 * means whatever the person reading it wants it to mean. The definition is
 * shown next to the picker rather than living only in someone's head.
 */
/**
 * Named in plain words rather than P1..P4, which meant nothing without the
 * legend. The ids stay p1..p4 so stored tasks need no migration.
 */
export const PRIORITIES = [
  { id: 'p1', label: 'Urgent',
    definition: 'Blocking or time-critical. Do it today, before anything else.',
    className: 'bg-red-600 text-white border-red-600',
    dot: 'bg-red-600' },
  { id: 'p2', label: 'Important',
    definition: 'Matters, but nothing is blocked on it. Plan it into the next day or two.',
    className: 'bg-amber-500 text-white border-amber-500',
    dot: 'bg-amber-500' },
  { id: 'p3', label: 'Upcoming',
    definition: 'Normal work with a date approaching. Fits somewhere this week.',
    className: 'bg-sky-600 text-white border-sky-600',
    dot: 'bg-sky-600' },
  { id: 'p4', label: 'Someday',
    definition: 'Nice to have. No deadline — drop it if the week fills up.',
    className: 'bg-zinc-500 text-white border-zinc-500',
    dot: 'bg-zinc-500' },
] as const;

export type PriorityId = typeof PRIORITIES[number]['id'];

export const priorityOf = (id: string | null | undefined) =>
  PRIORITIES.find((p) => p.id === id) ?? null;

/** Rank for sorting; anything unset sorts below every explicit tier. */
export const PRIORITY_RANK: Record<string, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };

// The three old tiers map onto the top three, so an existing "high" task stays
// the most urgent thing on the list. P4 is a new tier below what existed.
const LEGACY_PRIORITY: Record<string, PriorityId> = { high: 'p1', medium: 'p2', low: 'p3' };

/** Used when a task has no estimate of its own, so the builder still places it. */
export const DEFAULT_ESTIMATE_MINUTES = 30;

export const MEAL_SLOTS: [MealSlot, string][] = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['snacks', 'Snacks'],
  ['dinner', 'Dinner'],
];

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function defaultState(): AppState {
  return {
    version: 2,
    workspaces: DEFAULT_WORKSPACES.map((w) => ({ ...w })),
    tasks: [],
    blocks: [],
    template: [],
    labels: [...DEFAULT_LABELS],
    meals: {},
    money: [],
    settings: {
      theme: 'system',
      alarms: [
        { id: 'plan-tomorrow', label: "Plan tomorrow's timetable", time: '20:00', enabled: false, checkPlanning: true },
      ],
    },
  };
}

/**
 * Repairs anything the render code indexes into unguarded. A partial import or
 * a half-written synced document has to be fixed here or the whole app blanks.
 */
export function migrate(raw: any): AppState {
  const s: AppState = { ...defaultState(), ...(raw && typeof raw === 'object' ? raw : {}) };

  if (!Array.isArray(s.workspaces)) s.workspaces = defaultState().workspaces;
  if (!Array.isArray(s.tasks)) s.tasks = [];
  if (!Array.isArray(s.blocks)) s.blocks = [];
  if (!Array.isArray(s.labels)) s.labels = [...DEFAULT_LABELS];
  if (!Array.isArray(s.template)) s.template = [];
  if (!s.meals || typeof s.meals !== 'object' || Array.isArray(s.meals)) s.meals = {};
  if (!Array.isArray(s.money)) s.money = [];
  s.money = s.money.filter((m) => m && typeof m === 'object' && m.id
    && Number.isFinite(m.amount) && m.amount > 0);

  s.workspaces = s.workspaces.filter((w) => w && typeof w === 'object' && w.id);
  s.tasks = s.tasks.filter((t) => t && typeof t === 'object' && t.id);
  s.blocks = s.blocks.filter((b) => b && typeof b === 'object' && b.id);
  if (s.workspaces.length === 0) s.workspaces = defaultState().workspaces;

  if (!s.settings || typeof s.settings !== 'object') s.settings = defaultState().settings;
  if (!Array.isArray(s.settings.alarms)) s.settings.alarms = defaultState().settings.alarms;

  if (!s.workspaces.some((w) => w.id === 'stats')) {
    s.workspaces.push({ id: 'stats', name: 'Stats', icon: '📊', system: true, type: 'stats' });
  }
  if (!s.workspaces.some((w) => w.id === 'adhoc')) {
    // Right after Tasks, since that is where an unplanned thing would
    // otherwise have been dropped.
    const tasksIdx = s.workspaces.findIndex((w) => w.id === 'tasks');
    const at = tasksIdx === -1 ? s.workspaces.length : tasksIdx + 1;
    s.workspaces.splice(at, 0, { id: 'adhoc', name: 'Adhoc', icon: '⚡', system: true, type: 'tasks' });
  }
  if (!s.workspaces.some((w) => w.id === 'content')) {
    const openingsIdx = s.workspaces.findIndex((w) => w.id === 'openings');
    const statsIdx = s.workspaces.findIndex((w) => w.id === 'stats');
    const at = openingsIdx !== -1 ? openingsIdx : statsIdx !== -1 ? statsIdx : s.workspaces.length;
    s.workspaces.splice(at, 0, { id: 'content', name: 'Content', icon: '📣', system: true, type: 'tasks' });
  }
  if (!s.workspaces.some((w) => w.id === 'finance')) {
    const statsIdx = s.workspaces.findIndex((w) => w.id === 'stats');
    const at = statsIdx === -1 ? s.workspaces.length : statsIdx;
    s.workspaces.splice(at, 0, { id: 'finance', name: 'Finance', icon: '💰', system: true, type: 'finance' });
  }
  if (!s.workspaces.some((w) => w.id === 'openings')) {
    // Before Meals, keeping the work-ish workspaces together.
    const mealsIdx = s.workspaces.findIndex((w) => w.id === 'meals');
    const statsIdx = s.workspaces.findIndex((w) => w.id === 'stats');
    const at = mealsIdx !== -1 ? mealsIdx : statsIdx !== -1 ? statsIdx : s.workspaces.length;
    s.workspaces.splice(at, 0, { id: 'openings', name: 'Openings', icon: '💼', system: true, type: 'tasks' });
  }
  if (!s.workspaces.some((w) => w.id === 'meals')) {
    // Before Stats, which is always meant to be the last tab.
    const statsIdx = s.workspaces.findIndex((w) => w.id === 'stats');
    const at = statsIdx === -1 ? s.workspaces.length : statsIdx;
    s.workspaces.splice(at, 0, { id: 'meals', name: 'Meals', icon: '🍳', system: true, type: 'meals' });
  }
  // The Companies workspace and its seeded list were dropped; clean up installs
  // that still carry them rather than leaving a workspace with no code behind it.
  if (s.workspaces.some((w) => w.id === 'companies')) {
    s.workspaces = s.workspaces.filter((w) => w.id !== 'companies');
    s.tasks = s.tasks.filter((t) => t.workspaceId !== 'companies');
  }
  delete (s as any).companiesSeeded;

  s.tasks.forEach((t) => {
    if (t.priority === undefined) t.priority = null;
    if (t.priority && LEGACY_PRIORITY[t.priority as string]) {
      t.priority = LEGACY_PRIORITY[t.priority as string];
    } else if (t.priority && !PRIORITY_RANK[t.priority]) {
      t.priority = null;
    }
    if (t.dueDate === undefined) t.dueDate = null;
    if (t.dueTime === undefined) t.dueTime = null;
    if (typeof t.link !== 'string' || !t.link) t.link = null;
    if (!Array.isArray(t.dependsOn)) t.dependsOn = [];
    t.dependsOn = t.dependsOn.filter((d) => typeof d === 'string' && d !== t.id);
    if (typeof t.estimateMinutes !== 'number' || !(t.estimateMinutes > 0)) t.estimateMinutes = null;
    if (typeof t.quantity !== 'number' || !(t.quantity > 0)) t.quantity = null;
    if (t.recurrence === undefined) t.recurrence = 'none';
    if (!t.completions || typeof t.completions !== 'object') t.completions = {};
    if (!Array.isArray(t.labels)) t.labels = [];
    if (typeof t.notes !== 'string') t.notes = '';
    if (t.completedAt === undefined) t.completedAt = t.done ? (t.createdAt || Date.now()) : null;
  });
  s.blocks.forEach((b) => {
    if (!Array.isArray(b.subtasks)) b.subtasks = [];
    // A block used to link one task; it now holds a list across workspaces.
    const legacy = (b as any).taskId;
    if (!Array.isArray(b.taskIds)) b.taskIds = legacy ? [legacy] : [];
    b.taskIds = b.taskIds.filter((id) => typeof id === 'string');
    delete (b as any).taskId;
    // Blocks planned before day-marking existed are unmarked, not missed.
    if (b.status !== 'done' && b.status !== 'missed') b.status = null;
    // Blocks made before per-block reminders existed stay silent.
    if (typeof b.reminder !== 'boolean') b.reminder = false;
  });

  return s;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return migrate(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

/** Called after every persisted change — the sync layer hooks in here. */
export let afterSave: (() => void) | null = null;
export const setAfterSave = (fn: (() => void) | null) => { afterSave = fn; };

function emit() {
  // Mutations are made in place, so every collection needs a fresh reference
  // here. Without it a selector returning s.blocks hands back the same array,
  // React concludes nothing changed and skips the render -- and any useMemo
  // keyed on that array quietly serves a stale result. Copying a few hundred
  // references per save costs nothing next to the class of bug it removes.
  state = {
    ...state,
    workspaces: [...state.workspaces],
    tasks: [...state.tasks],
    blocks: [...state.blocks],
    template: [...state.template],
    labels: [...state.labels],
    meals: { ...state.meals },
    settings: { ...state.settings, alarms: [...state.settings.alarms] },
  };
  listeners.forEach((l) => l());
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode — the in-memory state is still correct.
  }
  emit();
  afterSave?.();
}

export const getState = () => state;

/** Replaces everything, e.g. applying a cloud copy or an imported backup. */
export function replaceState(next: any, { silent = false } = {}) {
  state = migrate(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* see save() */ }
  emit();
  if (!silent) afterSave?.();
}

export function update(fn: (draft: AppState) => void) {
  fn(state);
  save();
}

/**
 * A selector that derives a fresh object or array — `s => Object.keys(s.meals)`,
 * say — would hand useSyncExternalStore a new reference on every call, and
 * React would re-render until it threw "maximum update depth exceeded". Every
 * mutation already swaps the top-level state object, so caching against that
 * reference makes any selector safe to write without thinking about identity.
 */
export function useStore<T>(selector: (s: AppState) => T): T {
  const cache = useRef<{ state: AppState; value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    if (cache.current && cache.current.state === state) return cache.current.value;
    const value = selector(state);
    cache.current = { state, value };
    return value;
    // `selector` is intentionally not a dependency: call sites pass an inline
    // arrow, so a new identity each render would defeat the cache entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    getSnapshot,
    getSnapshot,
  );
}

/* ------------------------------- mutations ------------------------------- */

/**
 * Accepts a pasted URL with or without a scheme, and refuses anything that is
 * not http(s) — a stored `javascript:` string would otherwise become a live
 * link the moment it is rendered as an anchor.
 */
export function normalizeLink(raw: string | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function addTask(workspaceId: string, title: string, labels: string[], extra: Partial<Task> = {}) {
  update((s) => {
    s.tasks.push({
      id: uid(), workspaceId, title, notes: extra.notes ?? '', labels, done: false,
      priority: extra.priority ?? null,
      dueDate: extra.dueDate ?? null,
      dueTime: extra.dueTime ?? null,
      link: normalizeLink(extra.link ?? null),
      dependsOn: extra.dependsOn ?? [],
      estimateMinutes: extra.estimateMinutes ?? null,
      quantity: extra.quantity ?? null,
      recurrence: extra.recurrence ?? 'none',
      completions: {}, createdAt: Date.now(), completedAt: null,
    });
  });
}

export function addLabel(name: string) {
  const label = name.trim();
  if (!label) return false;
  let added = false;
  update((s) => {
    // Case-insensitive, so "Instagram" and "instagram" do not both appear.
    if (s.labels.some((l) => l.toLowerCase() === label.toLowerCase())) return;
    s.labels.push(label);
    added = true;
  });
  return added;
}

export const removeLabel = (label: string) =>
  update((s) => {
    s.labels = s.labels.filter((l) => l !== label);
    // Strip it from every task too, or filters would offer a label nothing has.
    s.tasks.forEach((t) => { t.labels = t.labels.filter((l) => l !== label); });
  });

export const updateTask = (id: string, patch: Partial<Task>) =>
  update((s) => { const t = s.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); });

export const deleteTask = (id: string) =>
  update((s) => {
    s.tasks = s.tasks.filter((x) => x.id !== id);
    // Unlink it everywhere, or blocks would render a task that no longer
    // exists and other tasks would wait forever on a missing prerequisite.
    s.blocks.forEach((b) => { b.taskIds = b.taskIds.filter((x) => x !== id); });
    s.tasks.forEach((t) => { t.dependsOn = t.dependsOn.filter((x) => x !== id); });
  });

export function isTaskDoneToday(t: Task) {
  return t.recurrence === 'none' ? t.done : !!t.completions[todayStr()];
}

export function toggleTaskDone(id: string) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.recurrence === 'none') {
      t.done = !t.done;
      t.completedAt = t.done ? Date.now() : null;
    } else {
      const d = todayStr();
      if (t.completions[d]) delete t.completions[d];
      else t.completions[d] = true;
    }
  });
}

/**
 * Consecutive completed days ending today. A streak counts only days actually
 * ticked, today included — so it reads 0 until today is done, rather than
 * carrying yesterday's run forward on a day that has not been earned yet.
 */
export function streakOf(t: Task) {
  if (t.recurrence === 'none') return 0;
  let streak = 0;
  let cursor = todayStr();
  while (t.completions[cursor]) {
    streak += 1;
    cursor = addDaysStr(cursor, -1);
  }
  return streak;
}

/**
 * The longest run of consecutive completed days in the whole history. Shown
 * next to the current streak so a day not yet ticked reads as "0 today" rather
 * than erasing everything that came before it.
 */
export function bestStreakOf(t: Task) {
  const days = Object.keys(t.completions).filter((d) => t.completions[d]).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  days.forEach((d) => {
    run = prev && addDaysStr(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  });
  return best;
}

export const addBlock = (
  date: string, title: string, start: string, end: string, taskIds: string[], reminder = false,
) =>
  update((s) => {
    s.blocks.push({ id: uid(), date, title, start, end, taskIds, reminder, status: null, subtasks: [] });
  });

/** Monday-based weekday index for a date string: Mon = 0 ... Sun = 6. */
export function weekdayOf(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/**
 * Writes the same block onto every matching day for a stretch of weeks, so a
 * daily fixture like a workout is planned once rather than seven times.
 *
 * Real blocks are created rather than a recurrence rule evaluated on the fly:
 * each day can then be edited, marked done or deleted on its own, which is the
 * whole point of a planner. A day that already holds this block at this time is
 * skipped, so re-running it to extend a plan never doubles anything up.
 */
export function addRepeatingBlocks(
  startDate: string,
  title: string,
  start: string,
  end: string,
  taskIds: string[],
  reminder: boolean,
  weekdays: number[],
  weeks: number,
) {
  let created = 0;
  update((s) => {
    for (let i = 0; i < weeks * 7; i += 1) {
      const date = addDaysStr(startDate, i);
      if (!weekdays.includes(weekdayOf(date))) continue;
      if (s.blocks.some((b) => b.date === date && b.start === start && b.title === title)) continue;
      s.blocks.push({
        id: uid(), date, title, start, end,
        taskIds: [...taskIds], reminder, status: null, subtasks: [],
      });
      created += 1;
    }
  });
  return created;
}

export const toggleBlockReminder = (id: string) =>
  update((s) => {
    const b = s.blocks.find((x) => x.id === id);
    if (b) b.reminder = !b.reminder;
  });

/** Tapping the mark already set clears it, so a mis-tap is one tap to undo. */
export const setBlockStatus = (id: string, status: BlockStatus) =>
  update((s) => {
    const b = s.blocks.find((x) => x.id === id);
    if (b) b.status = b.status === status ? null : status;
  });

export interface DayReport {
  date: string; done: number; missed: number; unmarked: number; total: number;
  /** Share of the blocks that were actually marked done; null when none were marked at all. */
  rate: number | null;
}

export function reportFor(s: AppState, date: string): DayReport {
  const blocks = s.blocks.filter((b) => b.date === date);
  const done = blocks.filter((b) => b.status === 'done').length;
  const missed = blocks.filter((b) => b.status === 'missed').length;
  const marked = done + missed;
  return {
    date,
    done,
    missed,
    unmarked: blocks.length - marked,
    total: blocks.length,
    // Scored against what was actually judged, so a half-marked day is not
    // punished for the blocks that were never looked at.
    rate: marked ? (done / marked) * 100 : null,
  };
}

export const updateBlock = (id: string, patch: Partial<Block>) =>
  update((s) => { const b = s.blocks.find((x) => x.id === id); if (b) Object.assign(b, patch); });

export const deleteBlock = (id: string) =>
  update((s) => { s.blocks = s.blocks.filter((x) => x.id !== id); });

export const addSubtask = (blockId: string, title: string) =>
  update((s) => { s.blocks.find((b) => b.id === blockId)?.subtasks.push({ id: uid(), title, done: false }); });

export const toggleSubtask = (blockId: string, subId: string) =>
  update((s) => {
    const st = s.blocks.find((b) => b.id === blockId)?.subtasks.find((x) => x.id === subId);
    if (st) st.done = !st.done;
  });

export const deleteSubtask = (blockId: string, subId: string) =>
  update((s) => {
    const b = s.blocks.find((x) => x.id === blockId);
    if (b) b.subtasks = b.subtasks.filter((x) => x.id !== subId);
  });

export const saveDayAsTemplate = (dateStr: string) =>
  update((s) => {
    // A template is a plan, so it deliberately carries no done/missed marks.
    s.template = s.blocks.filter((b) => b.date === dateStr).map((b) => ({
      id: uid(), title: b.title, start: b.start, end: b.end, reminder: b.reminder,
      subtasks: b.subtasks.map((x) => ({ id: uid(), title: x.title, done: false })),
    }));
  });

export const loadTemplateIntoDay = (dateStr: string) =>
  update((s) => {
    s.blocks = s.blocks.filter((b) => b.date !== dateStr);
    s.template.forEach((t) => {
      s.blocks.push({
        id: uid(), date: dateStr, title: t.title, start: t.start, end: t.end, taskIds: [],
        reminder: !!t.reminder, status: null,
        subtasks: t.subtasks.map((x) => ({ id: uid(), title: x.title, done: false })),
      });
    });
  });

/* -------------------------------- finance -------------------------------- */

/** Categories per kind — an investment is not filed under "Food". */
export const MONEY_CATEGORIES: Record<MoneyKind, string[]> = {
  expense: ['Food', 'Rent', 'Travel', 'Bills', 'Shopping', 'Health', 'Fees', 'Subscriptions', 'Other'],
  income: ['Salary', 'Freelance', 'Refund', 'Interest', 'Other'],
  investment: ['Mutual funds', 'Stocks', 'SIP', 'PPF / EPF', 'Gold', 'Crypto', 'Fixed deposit', 'Other'],
};

export const MONEY_KINDS: { id: MoneyKind; label: string }[] = [
  { id: 'expense', label: 'Spent' },
  { id: 'income', label: 'Received' },
  { id: 'investment', label: 'Invested' },
];

export const addMoney = (
  date: string, amount: number, kind: MoneyKind, category: string, note: string,
) => update((s) => {
  s.money = [
    { id: uid(), date, amount: Math.abs(amount), kind, category, note },
    ...s.money,
  ];
});

export const deleteMoney = (id: string) =>
  update((s) => { s.money = s.money.filter((m) => m.id !== id); });

/** 'YYYY-MM' for a date string, which is how the ledger is grouped. */
export const monthOf = (dateStr: string) => dateStr.slice(0, 7);

export interface MonthSummary {
  income: number;
  expense: number;
  invested: number;
  /** What is left after spending and investing. */
  net: number;
  spentByCategory: { category: string; total: number }[];
  investedByCategory: { category: string; total: number }[];
  /** Spend per day, oldest first, for the daily view. */
  perDay: { date: string; total: number }[];
  busiestDay: { date: string; total: number } | null;
  daysWithSpend: number;
  entries: MoneyEntry[];
}

const sumBy = (entries: MoneyEntry[], kind: MoneyKind) =>
  entries.filter((m) => m.kind === kind).reduce((a, m) => a + m.amount, 0);

function groupByCategory(entries: MoneyEntry[], kind: MoneyKind) {
  const totals = new Map<string, number>();
  entries.filter((m) => m.kind === kind).forEach((m) => {
    totals.set(m.category, (totals.get(m.category) ?? 0) + m.amount);
  });
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function summariseMonth(s: AppState, month: string): MonthSummary {
  const entries = s.money
    .filter((m) => monthOf(m.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));

  const income = sumBy(entries, 'income');
  const expense = sumBy(entries, 'expense');
  const invested = sumBy(entries, 'investment');

  // Every day of the month gets a row, including the ones with nothing on
  // them: a gap in the bars is itself worth seeing.
  const [y, m] = month.split('-').map(Number);
  const dayCount = new Date(y, m, 0).getDate();
  const spentOn = new Map<string, number>();
  entries.filter((e) => e.kind === 'expense').forEach((e) => {
    spentOn.set(e.date, (spentOn.get(e.date) ?? 0) + e.amount);
  });
  const perDay = Array.from({ length: dayCount }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { date, total: spentOn.get(date) ?? 0 };
  });
  const busiestDay = perDay.reduce<{ date: string; total: number } | null>(
    (best, d) => (d.total > 0 && (!best || d.total > best.total) ? d : best), null);

  return {
    income,
    expense,
    invested,
    net: income - expense - invested,
    spentByCategory: groupByCategory(entries, 'expense'),
    investedByCategory: groupByCategory(entries, 'investment'),
    perDay,
    busiestDay,
    daysWithSpend: spentOn.size,
    entries,
  };
}

/* --------------------------------- meals --------------------------------- */

export const getMeal = (dateStr: string, slot: MealSlot) => state.meals[dateStr]?.[slot] ?? '';

/**
 * Replaces the meals map rather than mutating it. Anything selecting `s.meals`
 * or deriving from it compares by reference, so an in-place edit would leave
 * the dish suggestions stale and let a re-render be skipped entirely.
 */
export function setMeal(dateStr: string, slot: MealSlot, value: string) {
  update((s) => {
    const dish = value.trim();
    const meals = { ...s.meals };
    const day: MealDay = { ...(meals[dateStr] ?? {}) };
    if (dish) day[slot] = dish;
    else delete day[slot];
    // Drop emptied days so the saved state doesn't accumulate an empty object
    // for every day that was ever opened.
    if (Object.keys(day).length === 0) delete meals[dateStr];
    else meals[dateStr] = day;
    s.meals = meals;
  });
}

/** Dishes already planned, most recent first — the autocomplete list. */
export function dishSuggestions(meals: Record<string, MealDay>) {
  const seen = new Map<string, string>();
  Object.keys(meals).sort().reverse().forEach((date) => {
    const day = meals[date];
    if (!day || typeof day !== 'object') return;
    MEAL_SLOTS.forEach(([slot]) => {
      const dish = day[slot];
      if (dish && !seen.has(dish.toLowerCase())) seen.set(dish.toLowerCase(), dish);
    });
  });
  return [...seen.values()];
}

export function countPlannedMeals(s: AppState, days: string[]) {
  let n = 0;
  days.forEach((d) => MEAL_SLOTS.forEach(([slot]) => { if (s.meals[d]?.[slot]) n += 1; }));
  return n;
}

/** Fills only the empty slots from the same weekday a week earlier. */
export function copyPreviousWeekMeals(days: string[]) {
  let filled = 0;
  update((s) => {
    const meals = { ...s.meals };
    days.forEach((d) => {
      const day: MealDay = { ...(meals[d] ?? {}) };
      MEAL_SLOTS.forEach(([slot]) => {
        if (day[slot]) return;
        const [y, m, dd] = d.split('-').map(Number);
        const prevDt = new Date(y, m - 1, dd);
        prevDt.setDate(prevDt.getDate() - 7);
        const prev = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, '0')}-${String(prevDt.getDate()).padStart(2, '0')}`;
        const dish = meals[prev]?.[slot];
        if (!dish) return;
        day[slot] = dish;
        filled += 1;
      });
      if (Object.keys(day).length > 0) meals[d] = day;
    });
    if (filled) s.meals = meals;
  });
  return filled;
}
