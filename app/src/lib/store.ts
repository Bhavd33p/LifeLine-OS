import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { AppState, Block, MealDay, MealSlot, Task, Workspace } from './types';
import { todayStr } from './date';

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
  { id: 'meals', name: 'Meals', icon: '🍳', system: true, type: 'meals' },
  { id: 'stats', name: 'Stats', icon: '📊', system: true, type: 'stats' },
];

/**
 * Four priority tiers with the meaning spelled out, because "high" on its own
 * means whatever the person reading it wants it to mean. The definition is
 * shown next to the picker rather than living only in someone's head.
 */
export const PRIORITIES = [
  { id: 'p1', label: 'P1', name: 'Now',
    definition: 'Blocking or time-critical. Do it today, before anything else.',
    className: 'bg-red-600 text-white border-red-600',
    dot: 'bg-red-600' },
  { id: 'p2', label: 'P2', name: 'Soon',
    definition: 'Important but not blocking. Plan it into the next day or two.',
    className: 'bg-amber-500 text-white border-amber-500',
    dot: 'bg-amber-500' },
  { id: 'p3', label: 'P3', name: 'Later',
    definition: 'Normal work. Fits somewhere this week.',
    className: 'bg-sky-600 text-white border-sky-600',
    dot: 'bg-sky-600' },
  { id: 'p4', label: 'P4', name: 'Someday',
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

  s.workspaces = s.workspaces.filter((w) => w && typeof w === 'object' && w.id);
  s.tasks = s.tasks.filter((t) => t && typeof t === 'object' && t.id);
  s.blocks = s.blocks.filter((b) => b && typeof b === 'object' && b.id);
  if (s.workspaces.length === 0) s.workspaces = defaultState().workspaces;

  if (!s.settings || typeof s.settings !== 'object') s.settings = defaultState().settings;
  if (!Array.isArray(s.settings.alarms)) s.settings.alarms = defaultState().settings.alarms;

  if (!s.workspaces.some((w) => w.id === 'stats')) {
    s.workspaces.push({ id: 'stats', name: 'Stats', icon: '📊', system: true, type: 'stats' });
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
    if (t.recurrence === undefined) t.recurrence = 'none';
    if (!t.completions || typeof t.completions !== 'object') t.completions = {};
    if (!Array.isArray(t.labels)) t.labels = [];
    if (typeof t.notes !== 'string') t.notes = '';
    if (t.completedAt === undefined) t.completedAt = t.done ? (t.createdAt || Date.now()) : null;
  });
  s.blocks.forEach((b) => {
    if (!Array.isArray(b.subtasks)) b.subtasks = [];
    if (b.taskId === undefined) b.taskId = null;
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
  // A fresh top-level reference each commit, so useSyncExternalStore sees a change.
  state = { ...state };
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

export function addTask(workspaceId: string, title: string, labels: string[], extra: Partial<Task> = {}) {
  update((s) => {
    s.tasks.push({
      id: uid(), workspaceId, title, notes: '', labels, done: false,
      priority: extra.priority ?? null,
      dueDate: extra.dueDate ?? null,
      dueTime: extra.dueTime ?? null,
      recurrence: extra.recurrence ?? 'none',
      completions: {}, createdAt: Date.now(), completedAt: null,
    });
  });
}

export const updateTask = (id: string, patch: Partial<Task>) =>
  update((s) => { const t = s.tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); });

export const deleteTask = (id: string) =>
  update((s) => {
    s.tasks = s.tasks.filter((x) => x.id !== id);
    s.blocks.forEach((b) => { if (b.taskId === id) b.taskId = null; });
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

/** Consecutive days up to today that a recurring task was completed. */
export function streakOf(t: Task) {
  if (t.recurrence === 'none') return 0;
  let streak = 0;
  let cursor = todayStr();
  // Today not being done yet shouldn't zero a streak mid-morning.
  if (!t.completions[cursor]) {
    const [y, m, d] = cursor.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    cursor = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  while (t.completions[cursor]) {
    streak += 1;
    const [y, m, d] = cursor.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    cursor = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return streak;
}

export const addBlock = (date: string, title: string, start: string, end: string, taskId: string | null) =>
  update((s) => { s.blocks.push({ id: uid(), date, title, start, end, taskId: taskId || null, subtasks: [] }); });

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
    s.template = s.blocks.filter((b) => b.date === dateStr).map((b) => ({
      id: uid(), title: b.title, start: b.start, end: b.end,
      subtasks: b.subtasks.map((x) => ({ id: uid(), title: x.title, done: false })),
    }));
  });

export const loadTemplateIntoDay = (dateStr: string) =>
  update((s) => {
    s.blocks = s.blocks.filter((b) => b.date !== dateStr);
    s.template.forEach((t) => {
      s.blocks.push({
        id: uid(), date: dateStr, title: t.title, start: t.start, end: t.end, taskId: null,
        subtasks: t.subtasks.map((x) => ({ id: uid(), title: x.title, done: false })),
      });
    });
  });

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
