'use strict';

import {
  firebaseReady, onAuthChange, signUp, signIn, signOutUser, watchUserDoc, pushState,
} from './sync.js';
import { icon, addIcon, workspaceIcon } from './icons.js';

/* ============================== Data model ============================== */

const STORAGE_KEY = 'personalOS.v1';
const LAST_WORKSPACE_KEY = 'personalOS.lastWorkspace';

const DEFAULT_LABELS = ['Important', 'Today', 'Tomorrow', 'Office', 'Personal'];

const DEFAULT_WORKSPACES = [
  { id: 'timetable', name: 'Timetable', icon: '🗓️', system: true, type: 'timetable' },
  { id: 'tasks', name: 'Tasks', icon: '✅', system: true, type: 'tasks' },
  { id: 'health', name: 'Health', icon: '❤️', system: true, type: 'tasks' },
  { id: 'cpdsa', name: 'CP / DSA', icon: '💻', system: true, type: 'tasks' },
  { id: 'companies', name: 'Companies', icon: '🏢', system: true, type: 'tasks' },
  { id: 'skincare', name: 'Skincare', icon: '✨', system: true, type: 'tasks' },
  { id: 'gym', name: 'Gym', icon: '🏋️', system: true, type: 'tasks' },
  { id: 'stats', name: 'Stats', icon: '📊', system: true, type: 'stats' },
];

const MOTIVATION_BANNER_TEXT = 'Apply daily. You are not destined to be here.';

// Curated MNCs with a strong India SDE1/SDE2 hiring presence, generally regarded
// (via Blind/Glassdoor/levels.fyi consensus) as paying well with decent-to-great WLB.
// Notes are qualitative, not quoted offers — always verify current comp on levels.fyi.
const COMPANY_SEED_DATA = [
  ['Google', 'Big Tech · top-tier comp, strong WLB'],
  ['Microsoft', 'Big Tech · strong comp, well-regarded WLB'],
  ['Amazon', 'Big Tech · high comp, WLB varies by team'],
  ['Adobe', 'Product · strong comp, good WLB reputation'],
  ['Salesforce', 'Enterprise SaaS · strong comp & benefits'],
  ['Atlassian', 'Product (Bangalore) · great WLB, remote-friendly'],
  ['ServiceNow', 'Enterprise SaaS · strong comp, good culture'],
  ['Walmart Global Tech', 'Retail tech · solid comp, stable WLB'],
  ['Visa', 'Fintech/payments · strong comp & stability'],
  ['Mastercard', 'Fintech/payments · strong comp & stability'],
  ['PayPal', 'Fintech · good comp, decent WLB'],
  ['Uber', 'Product · strong comp, fast-paced'],
  ['LinkedIn', 'Product (Microsoft) · strong comp, good culture'],
  ['Nutanix', 'Infra/cloud · strong comp, good WLB'],
  ['Cisco', 'Networking · stable comp, good WLB'],
  ['Intuit', 'Product · strong comp, well-regarded culture'],
  ['SAP Labs', 'Enterprise software · solid comp, great WLB'],
  ['VMware (Broadcom)', 'Infra/cloud · strong comp'],
  ['Qualcomm', 'Semiconductor · strong comp, good WLB'],
  ['NVIDIA', 'Semiconductor/AI · top-tier comp'],
  ['Texas Instruments', 'Semiconductor · stable comp, great WLB'],
  ['Micron Technology', 'Semiconductor · strong comp, good WLB'],
  ['Juniper Networks', 'Networking · solid comp, good WLB'],
  ['Arista Networks', 'Networking · strong comp'],
  ['Dell Technologies', 'Hardware/cloud · stable comp, good WLB'],
  ['Hewlett Packard Enterprise', 'Hardware/cloud · stable comp, good WLB'],
  ['IBM', 'Enterprise/research · stable comp, good WLB'],
  ['Goldman Sachs (Engineering)', 'Finance tech · very strong comp'],
  ['Morgan Stanley (Technology)', 'Finance tech · strong comp'],
  ['JPMorgan Chase (Technology)', 'Finance tech · strong comp, stable'],
  ['Barclays (Technology)', 'Finance tech · good comp, good WLB'],
  ['Deutsche Bank (Technology)', 'Finance tech · good comp, good WLB'],
  ['American Express (Technology)', 'Finance tech · good comp, great WLB'],
  ['Rubrik', 'Cloud data mgmt · strong comp'],
  ['Confluent', 'Data infra · strong comp'],
  ['Databricks', 'Data/AI · top-tier comp'],
  ['Splunk (Cisco)', 'Data/observability · strong comp'],
  ['Palo Alto Networks', 'Security · strong comp'],
  ['Akamai Technologies', 'Cloud/CDN · solid comp, good WLB'],
  ['Autodesk', 'Product · solid comp, good WLB'],
  ['Workday', 'Enterprise SaaS · strong comp, good culture'],
  ['Twilio', 'Product · solid comp'],
  ['GoDaddy', 'Product · solid comp, good WLB'],
  ['Expedia Group', 'Travel tech · solid comp, good WLB'],
  ['UBS', 'Finance tech · strong comp, good WLB'],
  ['Wells Fargo (Technology)', 'Finance tech · good comp, great WLB'],
  ['Target Corporation (Tech)', 'Retail tech · good comp, great WLB'],
  ['Samsung R&D Institute India', 'R&D · solid comp, stable WLB'],
  ['Bosch Global Software Technologies', 'Auto/industrial tech · great WLB'],
  ['Philips Innovation Campus', 'HealthTech R&D · great WLB'],
];

const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

function defaultState() {
  return {
    version: 2,
    workspaces: DEFAULT_WORKSPACES.map((w) => ({ ...w })),
    // task: {id, workspaceId, title, notes, labels:[], done, priority:'low'|'medium'|'high'|null,
    //        dueDate:'YYYY-MM-DD'|null, dueTime:'HH:MM'|null, recurrence:'none'|'daily'|'weekly',
    //        completions:{'YYYY-MM-DD':true}, createdAt, completedAt}
    tasks: [],
    // block: {id, date:'YYYY-MM-DD', title, start:'HH:MM', end:'HH:MM', taskId, subtasks:[{id,title,done}]}
    blocks: [],
    template: [], // block-shape without date
    labels: [...DEFAULT_LABELS],
    settings: {
      theme: 'system',
      alarms: [
        { id: 'plan-tomorrow', label: "Plan tomorrow's timetable", time: '20:00', enabled: false, checkPlanning: true },
      ],
    },
  };
}

const Store = {
  state: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.state = raw ? JSON.parse(raw) : defaultState();
      if (!this.state || !Array.isArray(this.state.workspaces)) this.state = defaultState();
      this.migrate();
    } catch (e) {
      this.state = defaultState();
    }
  },
  /** Fills in fields added by later versions so old saved/imported/synced data keeps working. */
  migrate() {
    // Every collection below is indexed into unguarded all over the render code,
    // so anything malformed (a partial import, a half-written synced doc) has to
    // be repaired here or the whole app renders blank.
    if (!Array.isArray(this.state.workspaces)) this.state.workspaces = defaultState().workspaces;
    if (!Array.isArray(this.state.tasks)) this.state.tasks = [];
    if (!Array.isArray(this.state.blocks)) this.state.blocks = [];
    if (!Array.isArray(this.state.labels)) this.state.labels = [...DEFAULT_LABELS];
    if (!Array.isArray(this.state.template)) this.state.template = [];
    this.state.workspaces = this.state.workspaces.filter((w) => w && typeof w === 'object' && w.id);
    this.state.tasks = this.state.tasks.filter((t) => t && typeof t === 'object' && t.id);
    this.state.blocks = this.state.blocks.filter((b) => b && typeof b === 'object' && b.id);
    if (this.state.workspaces.length === 0) this.state.workspaces = defaultState().workspaces;
    if (!this.state.settings || typeof this.state.settings !== 'object') {
      this.state.settings = defaultState().settings;
    }
    if (!Array.isArray(this.state.settings.alarms)) {
      this.state.settings.alarms = [{
        id: 'plan-tomorrow',
        label: "Plan tomorrow's timetable",
        time: this.state.settings.reminderTime || '20:00',
        enabled: !!this.state.settings.reminderEnabled,
        checkPlanning: true,
      }];
      delete this.state.settings.reminderEnabled;
      delete this.state.settings.reminderTime;
    }
    if (!this.state.workspaces.some((w) => w.id === 'stats')) {
      this.state.workspaces.push({ id: 'stats', name: 'Stats', icon: '📊', system: true, type: 'stats' });
    }
    if (!this.state.workspaces.some((w) => w.id === 'companies')) {
      const cpdsaIdx = this.state.workspaces.findIndex((w) => w.id === 'cpdsa');
      const insertAt = cpdsaIdx === -1 ? this.state.workspaces.length : cpdsaIdx + 1;
      this.state.workspaces.splice(insertAt, 0, { id: 'companies', name: 'Companies', icon: '🏢', system: true, type: 'tasks' });
    }
    if (!this.state.companiesSeeded) {
      COMPANY_SEED_DATA.forEach(([name, note]) => {
        this.state.tasks.push({
          id: uid(),
          workspaceId: 'companies',
          title: name,
          notes: note,
          labels: [],
          done: false,
          priority: null,
          dueDate: null,
          dueTime: null,
          recurrence: 'none',
          completions: {},
          createdAt: Date.now(),
          completedAt: null,
        });
      });
      this.state.companiesSeeded = true;
    }
    if (!this.state.templeTaskSeeded) {
      this.state.tasks.push({
        id: uid(),
        workspaceId: 'health',
        title: 'Go to temple',
        notes: '',
        labels: [],
        done: false,
        priority: null,
        dueDate: null,
        dueTime: null,
        recurrence: 'daily',
        completions: {},
        createdAt: Date.now(),
        completedAt: null,
      });
      this.state.templeTaskSeeded = true;
    }
    this.state.tasks.forEach((t) => {
      if (t.priority === undefined) t.priority = null;
      if (t.dueDate === undefined) t.dueDate = null;
      if (t.dueTime === undefined) t.dueTime = null;
      if (t.recurrence === undefined) t.recurrence = 'none';
      if (!t.completions || typeof t.completions !== 'object') t.completions = {};
      if (t.completedAt === undefined) t.completedAt = t.done ? (t.createdAt || Date.now()) : null;
      if (t.notes === undefined) t.notes = '';
      // Filtering does t.labels.includes(...) on every render.
      if (!Array.isArray(t.labels)) t.labels = [];
      if (typeof t.title !== 'string') t.title = String(t.title == null ? '' : t.title);
      if (typeof t.createdAt !== 'number') t.createdAt = Date.now();
    });
    this.state.blocks.forEach((b) => {
      if (!Array.isArray(b.subtasks)) b.subtasks = [];
    });
    this.state.version = 2;
  },
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.saveFailed = false;
    } catch (e) {
      // Quota exceeded (or storage blocked in private mode). The in-memory state
      // is still good, so let the session continue rather than throwing mid-edit —
      // but tell the user, because nothing is being persisted any more.
      this.saveFailed = true;
      showToast('Could not save — device storage is full. Export a backup before closing.', 'error');
      return;
    }
    if (typeof Store.afterSave === 'function') Store.afterSave();
  },
};

/* ============================== Utilities ============================== */

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer = null;

/** Non-blocking status message. Used where alert() would trap the user mid-edit. */
function showToast(message, kind) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (kind ? ' toast-' + kind : '') + ' visible';
  el.textContent = message;
  el.setAttribute('role', 'status');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('visible'); }, 5000);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function dateToStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() { return dateToStr(new Date()); }

function addDaysStr(str, delta) {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dateToStr(dt);
}

function formatDateLabel(str) {
  const today = todayStr();
  if (str === today) return 'Today';
  if (str === addDaysStr(today, 1)) return 'Tomorrow';
  if (str === addDaysStr(today, -1)) return 'Yesterday';
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** 'HH:MM' -> minutes since midnight. Returns NaN for malformed input. */
function minutesOf(hhmm) {
  if (typeof hhmm !== 'string') return NaN;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** '14:30' -> '2:30 pm' — friendlier than 24h on a glanceable timeline. */
function formatTime12(hhmm) {
  const mins = minutesOf(hhmm);
  if (!Number.isFinite(mins)) return hhmm || '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m)} ${suffix}`;
}

/** 95 -> '1h 35m' */
function formatDuration(mins) {
  if (!Number.isFinite(mins) || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function getWorkspace(id) { return Store.state.workspaces.find((w) => w.id === id); }
function getAllLabels() { return Store.state.labels; }

function sortTasks(tasks, mode) {
  const arr = tasks.slice();
  if (mode === 'priority') {
    const weight = { high: 3, medium: 2, low: 1 };
    arr.sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0) || b.createdAt - a.createdAt);
  } else if (mode === 'due') {
    arr.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      const cmp = a.dueDate.localeCompare(b.dueDate);
      if (cmp !== 0) return cmp;
      return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
    });
  } else {
    arr.sort((a, b) => b.createdAt - a.createdAt);
  }
  return arr;
}

/* ============================== Mutations ============================== */

function addTask(workspaceId, title, labels, extra) {
  extra = extra || {};
  Store.state.tasks.push({
    id: uid(),
    workspaceId,
    title,
    notes: '',
    labels,
    done: false,
    priority: extra.priority || null,
    dueDate: extra.dueDate || null,
    dueTime: extra.dueTime || null,
    recurrence: extra.recurrence || 'none',
    completions: {},
    createdAt: Date.now(),
    completedAt: null,
  });
  Store.save();
}
function updateTask(id, patch) {
  const t = Store.state.tasks.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  Store.save();
}
function toggleTaskDone(id) {
  const t = Store.state.tasks.find((x) => x.id === id);
  if (t) {
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
  }
  Store.save();
}
/** For recurring tasks: toggles whether today's occurrence is done, instead of a single `done` flag. */
function toggleTaskCompletionToday(id) {
  const t = Store.state.tasks.find((x) => x.id === id);
  if (t) {
    const today = todayStr();
    if (!t.completions) t.completions = {};
    if (t.completions[today]) delete t.completions[today];
    else t.completions[today] = true;
  }
  Store.save();
}
function isTaskDoneToday(t) {
  return t.recurrence === 'none' ? t.done : !!(t.completions && t.completions[todayStr()]);
}
/** Consecutive days (ending today or yesterday) a recurring task has been completed. */
function taskStreak(t) {
  const days = Object.keys(t.completions || {});
  if (!days.length) return 0;
  const set = new Set(days);
  let cursor = todayStr();
  if (!set.has(cursor)) {
    cursor = addDaysStr(cursor, -1);
    if (!set.has(cursor)) return 0;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysStr(cursor, -1);
  }
  return streak;
}
function deleteTask(id) {
  Store.state.tasks = Store.state.tasks.filter((x) => x.id !== id);
  Store.state.blocks.forEach((b) => { if (b.taskId === id) b.taskId = null; });
  Store.save();
}

function addBlock(date, title, start, end, taskId) {
  Store.state.blocks.push({ id: uid(), date, title, start, end, taskId: taskId || null, subtasks: [] });
  Store.save();
}
function updateBlock(id, patch) {
  const b = Store.state.blocks.find((x) => x.id === id);
  if (b) Object.assign(b, patch);
  Store.save();
}
function deleteBlock(id) {
  Store.state.blocks = Store.state.blocks.filter((x) => x.id !== id);
  Store.save();
}
function addSubtask(blockId, title) {
  const b = Store.state.blocks.find((x) => x.id === blockId);
  if (b) b.subtasks.push({ id: uid(), title, done: false });
  Store.save();
}
function toggleSubtaskDone(blockId, subId) {
  const b = Store.state.blocks.find((x) => x.id === blockId);
  const s = b && b.subtasks.find((x) => x.id === subId);
  if (s) s.done = !s.done;
  Store.save();
}
function deleteSubtask(blockId, subId) {
  const b = Store.state.blocks.find((x) => x.id === blockId);
  if (b) b.subtasks = b.subtasks.filter((x) => x.id !== subId);
  Store.save();
}

function addWorkspace(name, icon) {
  const id = 'ws_' + uid();
  Store.state.workspaces.push({ id, name, icon: icon || '📁', system: false, type: 'tasks' });
  Store.save();
  return id;
}
function deleteWorkspace(id) {
  Store.state.workspaces = Store.state.workspaces.filter((w) => w.id !== id);
  Store.state.tasks = Store.state.tasks.filter((t) => t.workspaceId !== id);
  Store.save();
}

function saveDayAsTemplate(dateStr) {
  const blocks = Store.state.blocks.filter((b) => b.date === dateStr);
  if (!blocks.length) { alert('Nothing to save — add some blocks first.'); return; }
  Store.state.template = blocks.map((b) => ({
    id: uid(), title: b.title, start: b.start, end: b.end,
    subtasks: b.subtasks.map((s) => ({ id: uid(), title: s.title, done: false })),
  }));
  Store.save();
  alert('Saved as your daily template.');
}

function loadTemplateIntoDay(dateStr) {
  if (!Store.state.template.length) { alert('No saved template yet.'); return; }
  if (!confirm(`Replace ${formatDateLabel(dateStr)}'s blocks with your template?`)) return;
  Store.state.blocks = Store.state.blocks.filter((b) => b.date !== dateStr);
  Store.state.template.forEach((t) => {
    Store.state.blocks.push({
      id: uid(), date: dateStr, title: t.title, start: t.start, end: t.end, taskId: null,
      subtasks: t.subtasks.map((s) => ({ id: uid(), title: s.title, done: false })),
    });
  });
  Store.save();
  render();
}

/* ============================== App state ============================== */

let currentWorkspaceId = localStorage.getItem(LAST_WORKSPACE_KEY) || 'timetable';
let currentTimetableDate = todayStr();
const currentTaskFilter = {};
const currentTaskSort = {};

/* ============================== Contest schedule (CP/DSA) ============================== */

let contestCache = null; // { leetcode: [...], codeforces: [...] } | 'error'
let contestFetchInFlight = false;

async function fetchContests() {
  if (contestFetchInFlight || contestCache) return;
  contestFetchInFlight = true;
  try {
    const [lcRes, cfRes] = await Promise.all([
      fetch('https://competeapi.vercel.app/contests/leetcode/'),
      fetch('https://competeapi.vercel.app/contests/codeforces/'),
    ]);
    if (!lcRes.ok || !cfRes.ok) throw new Error('bad response');
    const lcData = await lcRes.json();
    const cfData = await cfRes.json();
    const lcContests = (lcData?.data?.topTwoContests || []).map((c) => ({
      title: c.title,
      startTime: c.startTime * 1000,
      duration: c.duration * 1000,
      url: 'https://leetcode.com/contest/',
      platform: 'LeetCode',
    }));
    const cfContests = (Array.isArray(cfData) ? cfData : [])
      .filter((c) => c.startTime > Date.now())
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 4)
      .map((c) => ({
        title: c.title,
        startTime: c.startTime,
        duration: c.duration,
        url: c.url || 'https://codeforces.com/contests',
        platform: 'Codeforces',
      }));
    contestCache = { leetcode: lcContests, codeforces: cfContests };
  } catch (err) {
    contestCache = 'error';
  } finally {
    contestFetchInFlight = false;
    render();
  }
}

function formatContestTime(ms) {
  const d = new Date(ms);
  const diffMs = ms - Date.now();
  const diffH = diffMs / 3600000;
  let rel;
  if (diffH < 1) rel = `in ${Math.max(1, Math.round(diffMs / 60000))}m`;
  else if (diffH < 24) rel = `in ${Math.round(diffH)}h`;
  else rel = `in ${Math.round(diffH / 24)}d`;
  const abs = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${abs} · ${rel}`;
}

function renderContestSection() {
  const section = document.createElement('div');
  section.className = 'contest-section';

  const heading = document.createElement('div');
  heading.className = 'contest-heading';
  heading.textContent = 'Upcoming Contests';
  section.appendChild(heading);

  if (!contestCache) {
    const loading = document.createElement('p');
    loading.className = 'contest-loading';
    loading.textContent = 'Loading live contest schedule...';
    section.appendChild(loading);
    fetchContests();
    return section;
  }

  if (contestCache === 'error') {
    const fallback = document.createElement('div');
    fallback.className = 'contest-fallback';
    fallback.innerHTML = 'Could not load live schedule. Check ' +
      '<a href="https://leetcode.com/contest/" target="_blank" rel="noopener">LeetCode contests</a> or ' +
      '<a href="https://codeforces.com/contests" target="_blank" rel="noopener">Codeforces contests</a> directly.';
    section.appendChild(fallback);
    return section;
  }

  const list = document.createElement('div');
  list.className = 'contest-list';
  const all = [...contestCache.leetcode, ...contestCache.codeforces].sort((a, b) => a.startTime - b.startTime);

  if (all.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'contest-loading';
    empty.textContent = 'No upcoming contests found.';
    list.appendChild(empty);
  } else {
    all.forEach((c) => {
      const card = document.createElement('a');
      card.className = 'contest-card platform-' + c.platform.toLowerCase();
      card.href = c.url;
      card.target = '_blank';
      card.rel = 'noopener';

      const badge = document.createElement('span');
      badge.className = 'contest-platform-badge';
      badge.textContent = c.platform;
      card.appendChild(badge);

      const title = document.createElement('span');
      title.className = 'contest-title';
      title.textContent = c.title;
      card.appendChild(title);

      const time = document.createElement('span');
      time.className = 'contest-time';
      time.textContent = formatContestTime(c.startTime);
      card.appendChild(time);

      list.appendChild(card);
    });
  }
  section.appendChild(list);
  return section;
}

function setWorkspace(id) {
  currentWorkspaceId = id;
  localStorage.setItem(LAST_WORKSPACE_KEY, id);
  render();
}

/* ============================== Sync (optional) ============================== */

let currentUser = null;
let applyingRemote = false;
let pushTimer = null;
let lastSyncError = null;
let lastSyncedAt = null;

function schedulePush() {
  if (!currentUser || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushState(currentUser.uid, Store.state)
      .then(() => { lastSyncError = null; lastSyncedAt = Date.now(); })
      .catch((e) => { lastSyncError = e.message || String(e); });
  }, 600);
}
Store.afterSave = schedulePush;

/** True when this device holds work that a fresh install wouldn't have. */
function hasLocalContent() {
  const s = Store.state;
  if (!s) return false;
  if (s.blocks.length || s.template.length) return true;
  // The seeded Companies list and temple task exist on every fresh install, so
  // they don't count as content the user would miss.
  return s.tasks.some((t) => t.workspaceId !== 'companies' && t.title !== 'Go to temple');
}

function countOf(state) {
  return {
    tasks: Array.isArray(state.tasks) ? state.tasks.length : 0,
    blocks: Array.isArray(state.blocks) ? state.blocks.length : 0,
  };
}

function sameState(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
}

/** Blocking choice — either answer loses data, so it can't be picked for them. */
function openSyncConflictModal(uid, remoteData) {
  const body = document.createElement('div');

  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = 'This device and your cloud account both have data, and they differ. '
    + 'Choose which one to keep — the other will be replaced.';
  body.appendChild(p);

  const local = countOf(Store.state);
  const remote = countOf(remoteData);

  const mkOption = (heading, counts, onPick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-result-row';
    const left = document.createElement('span');
    left.textContent = heading;
    const right = document.createElement('span');
    right.className = 'hint';
    right.textContent = `${counts.tasks} tasks · ${counts.blocks} blocks`;
    btn.appendChild(left);
    btn.appendChild(right);
    btn.addEventListener('click', onPick);
    return btn;
  };

  body.appendChild(mkOption('Keep this device’s data', local, () => {
    closeModal();
    // Overwrite the cloud with what's here.
    pushState(uid, Store.state)
      .then(() => showToast('Cloud updated from this device.', 'success'))
      .catch((e) => { lastSyncError = e.message || String(e); showToast('Could not update cloud: ' + lastSyncError, 'error'); });
  }));

  body.appendChild(mkOption('Use the cloud’s data', remote, () => {
    closeModal();
    applyingRemote = true;
    Store.state = remoteData;
    Store.migrate();
    Store.save();
    applyingRemote = false;
    render();
    showToast('This device now matches the cloud.', 'success');
  }));

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = 'Not sure? Close this, export a backup from Settings → Data first, then sign in again.';
  body.appendChild(note);

  openModal('Which copy should win?', body);
}

async function initSync() {
  if (!firebaseReady) return;
  try {
    await onAuthChange(async (user) => {
      currentUser = user;
      if (user) {
        let firstSnapshot = true;
        try {
          await watchUserDoc(user.uid, (remoteData) => {
            const wasFirst = firstSnapshot;
            firstSnapshot = false;

            if (!remoteData) {
              // First sign-in on this account: seed the cloud with what's local.
              pushState(user.uid, Store.state).catch((e) => { lastSyncError = e.message || String(e); });
              return;
            }

            // The first snapshot after signing in is the only moment where two
            // independent histories meet. Blindly taking the remote copy here
            // silently destroys anything created on this device before signing
            // in, so ask rather than guess.
            if (wasFirst && hasLocalContent() && !sameState(remoteData, Store.state)) {
              openSyncConflictModal(user.uid, remoteData);
              return;
            }

            applyingRemote = true;
            Store.state = remoteData;
            Store.migrate();
            Store.save();
            applyingRemote = false;
            render();
          });
        } catch (e) {
          lastSyncError = e.message || String(e);
        }
      }
      render();
    });
  } catch (e) {
    lastSyncError = e.message || String(e);
  }
}

/* ============================== Modal system ============================== */

function openModal(title, bodyEl) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  addIcon(closeBtn, 'close');
  closeBtn.addEventListener('click', closeModal);
  header.appendChild(h2);
  header.appendChild(closeBtn);

  modal.appendChild(header);
  modal.appendChild(bodyEl);
  overlay.appendChild(modal);
  root.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

/* ============================== Workspace nav ============================== */

/** Workspaces pinned to the mobile tab bar. Everything else lives behind "All". */
const PINNED_TABS = ['timetable', 'tasks', 'stats'];

function renderWorkspaceNav() {
  renderTopbar();
  renderSidebar();
  renderTabBar();
  renderChipRail();
  renderFab();
}

/** Title/subtitle reflect the workspace, so the header isn't dead space. */
function renderTopbar() {
  const ws = getWorkspace(currentWorkspaceId);
  const title = document.getElementById('viewTitle');
  const subtitle = document.getElementById('viewSubtitle');
  title.textContent = ws ? (ws.name || 'Untitled') : 'Personal OS';
  if (!ws) { subtitle.textContent = ''; return; }
  if (ws.type === 'timetable') {
    const count = Store.state.blocks.filter((b) => b.date === currentTimetableDate).length;
    subtitle.textContent = count ? `${count} block${count === 1 ? '' : 's'} planned` : 'Nothing planned';
  } else if (ws.type === 'stats') {
    subtitle.textContent = 'Your last 7 days';
  } else {
    const all = Store.state.tasks.filter((t) => t.workspaceId === ws.id);
    const open = all.filter((t) => !isTaskDoneToday(t)).length;
    subtitle.textContent = all.length ? `${open} open · ${all.length} total` : 'No tasks yet';
  }
  // On the root element, not #app — the FAB and tab bar live outside #app and
  // still need to pick up the workspace accent.
  document.documentElement.setAttribute('data-ws', ws.id);
}

function renderSidebar() {
  const side = document.getElementById('sidebar');
  side.innerHTML = '';
  const heading = document.createElement('div');
  heading.className = 'sidebar-heading';
  heading.textContent = 'Personal OS';
  side.appendChild(heading);

  Store.state.workspaces.forEach((ws) => {
    const item = document.createElement('button');
    item.className = 'side-item' + (ws.id === currentWorkspaceId ? ' active' : '');
    const ic = workspaceIcon(ws);
    if (ic) item.appendChild(ic);
    const name = document.createElement('span');
    name.textContent = ws.name || 'Untitled';
    item.appendChild(name);
    const count = workspaceBadgeCount(ws);
    if (count) {
      const badge = document.createElement('span');
      badge.className = 'side-count';
      badge.textContent = String(count);
      item.appendChild(badge);
    }
    item.addEventListener('click', () => setWorkspace(ws.id));
    side.appendChild(item);
  });

  const add = document.createElement('button');
  add.className = 'side-item side-add';
  addIcon(add, 'plus');
  const addLabel = document.createElement('span');
  addLabel.textContent = 'New workspace';
  add.appendChild(addLabel);
  add.addEventListener('click', openAddWorkspaceModal);
  side.appendChild(add);
}

/** Open-item count — surfaces where the work actually is without opening each. */
function workspaceBadgeCount(ws) {
  if (ws.type === 'timetable') {
    return Store.state.blocks.filter((b) => b.date === todayStr()).length;
  }
  if (ws.type === 'stats') return 0;
  return Store.state.tasks.filter((t) => t.workspaceId === ws.id && !isTaskDoneToday(t)).length;
}

function renderTabBar() {
  const bar = document.getElementById('tabbar');
  bar.innerHTML = '';
  const pinned = PINNED_TABS.map((id) => getWorkspace(id)).filter(Boolean);
  const onPinned = pinned.some((w) => w.id === currentWorkspaceId);

  const makeTab = (ws) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (ws.id === currentWorkspaceId ? ' active' : '');
    const ic = workspaceIcon(ws);
    if (ic) btn.appendChild(ic);
    const label = document.createElement('span');
    label.textContent = ws.name || 'Untitled';
    btn.appendChild(label);
    btn.addEventListener('click', () => setWorkspace(ws.id));
    return btn;
  };

  // Two tabs, the FAB's reserved slot, then the rest — the classic thumb layout.
  pinned.slice(0, 2).forEach((ws) => bar.appendChild(makeTab(ws)));
  const spacer = document.createElement('div');
  spacer.className = 'tab-spacer';
  bar.appendChild(spacer);
  pinned.slice(2).forEach((ws) => bar.appendChild(makeTab(ws)));

  const all = document.createElement('button');
  // When the user is in a non-pinned workspace, "All" carries the active state
  // and its name — otherwise nothing in the bar would look selected.
  all.className = 'tab-btn' + (onPinned ? '' : ' active');
  addIcon(all, 'grid');
  const allLabel = document.createElement('span');
  const currentWs = getWorkspace(currentWorkspaceId);
  allLabel.textContent = onPinned || !currentWs ? 'All' : (currentWs.name || 'All');
  all.appendChild(allLabel);
  all.addEventListener('click', openWorkspaceSheet);
  bar.appendChild(all);
}

/** Grid of every workspace — the mobile counterpart to the desktop sidebar. */
function openWorkspaceSheet() {
  const body = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'ws-grid';
  Store.state.workspaces.forEach((ws) => {
    const tile = document.createElement('button');
    tile.className = 'ws-tile' + (ws.id === currentWorkspaceId ? ' active' : '');
    const ic = workspaceIcon(ws);
    if (ic) tile.appendChild(ic);
    const name = document.createElement('span');
    name.textContent = ws.name || 'Untitled';
    tile.appendChild(name);
    tile.addEventListener('click', () => { closeModal(); setWorkspace(ws.id); });
    grid.appendChild(tile);
  });
  const add = document.createElement('button');
  add.className = 'ws-tile ws-add';
  addIcon(add, 'plus');
  const addLabel = document.createElement('span');
  addLabel.textContent = 'New';
  add.appendChild(addLabel);
  add.addEventListener('click', () => { closeModal(); openAddWorkspaceModal(); });
  grid.appendChild(add);
  body.appendChild(grid);
  openModal('Workspaces', body);
}

/** Narrow-screen chip rail above the content (hidden once the sidebar shows). */
function renderChipRail() {
  const nav = document.getElementById('workspaceNav');
  nav.innerHTML = '';
  let activeChip = null;
  Store.state.workspaces.forEach((ws) => {
    const chip = document.createElement('button');
    const isActive = ws.id === currentWorkspaceId;
    chip.className = 'ws-chip' + (isActive ? ' active' : '');
    const ic = workspaceIcon(ws);
    if (ic) chip.appendChild(ic);
    const name = document.createElement('span');
    name.textContent = ws.name || 'Untitled';
    chip.appendChild(name);
    chip.addEventListener('click', () => setWorkspace(ws.id));
    nav.appendChild(chip);
    if (isActive) activeChip = chip;
  });
  const addChip = document.createElement('button');
  addChip.className = 'ws-chip ws-add';
  addIcon(addChip, 'plus');
  addChip.setAttribute('aria-label', 'New workspace');
  addChip.addEventListener('click', openAddWorkspaceModal);
  nav.appendChild(addChip);
  if (activeChip) activeChip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  updateNavScrollFade(nav);
}

/** One primary action per workspace, always in thumb reach. */
function renderFab() {
  const fab = document.getElementById('fab');
  const ws = getWorkspace(currentWorkspaceId);
  if (!ws || ws.type === 'stats') { fab.hidden = true; return; }
  fab.hidden = false;
  fab.innerHTML = '';
  addIcon(fab, 'plus');
  fab.setAttribute('aria-label', ws.type === 'timetable' ? 'Add block' : `Add task in ${ws.name}`);
  fab.onclick = () => {
    if (ws.type === 'timetable') { openBlockModal(null); return; }
    const quick = document.querySelector('.quick-add');
    const input = quick && quick.querySelector('input[type="text"]');
    if (input) {
      quick.classList.add('expanded');
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
}

function updateNavScrollFade(nav) {
  const apply = () => {
    const atStart = nav.scrollLeft <= 4;
    const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4;
    nav.classList.toggle('fade-start', !atStart);
    nav.classList.toggle('fade-end', !atEnd);
  };
  apply();
  nav.onscroll = apply;
}

function openAddWorkspaceModal() {
  const body = document.createElement('form');
  body.className = 'modal-form';
  body.innerHTML = `
    <label>Name <input type="text" id="wsName" required placeholder="e.g. Reading" /></label>
    <label>Icon (emoji, optional) <input type="text" id="wsIcon" maxlength="4" placeholder="📚" /></label>
    <div class="modal-footer"><button type="submit" class="btn-primary">Add workspace</button></div>
  `;
  openModal('New workspace', body);
  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = body.querySelector('#wsName').value.trim();
    const icon = body.querySelector('#wsIcon').value.trim();
    if (!name) return;
    const id = addWorkspace(name, icon);
    closeModal();
    setWorkspace(id);
  });
}

/* ============================== Shared task-detail fields ============================== */

function buildPriorityRow(selected, onChange) {
  const row = document.createElement('div');
  row.className = 'label-picker';
  let current = selected || null;
  PRIORITIES.forEach((p) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'label-chip selectable priority-' + p + (current === p ? ' selected' : '');
    chip.textContent = PRIORITY_LABEL[p];
    chip.addEventListener('click', () => {
      current = current === p ? null : p;
      Array.from(row.children).forEach((c) => c.classList.remove('selected'));
      if (current) chip.classList.add('selected');
      onChange(current);
    });
    row.appendChild(chip);
  });
  return row;
}

/** Priority chip, due-date/time row, and recurrence select, collapsed behind a toggle. */
function buildTaskDetailsSection(task) {
  const wrap = document.createElement('div');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  const hasDetails = task && (task.priority || task.dueDate || (task.recurrence && task.recurrence !== 'none'));
  toggle.className = 'details-toggle' + (hasDetails ? ' open' : '');
  addIcon(toggle, 'chevronRight');
  toggle.appendChild(document.createTextNode('Priority, due date, repeat'));

  const box = document.createElement('div');
  box.className = 'details-box';
  box.style.display = hasDetails ? 'flex' : 'none';

  toggle.addEventListener('click', () => {
    const showing = box.style.display !== 'none';
    box.style.display = showing ? 'none' : 'flex';
    toggle.classList.toggle('open', !showing);
  });

  const state = {
    priority: task ? task.priority : null,
    dueDate: task ? task.dueDate : null,
    dueTime: task ? task.dueTime : null,
    recurrence: task ? task.recurrence : 'none',
  };

  const priorityRow = buildPriorityRow(state.priority, (p) => { state.priority = p; });
  box.appendChild(priorityRow);

  const dueRow = document.createElement('div');
  dueRow.className = 'time-row';
  const dueDateLabel = document.createElement('label');
  dueDateLabel.textContent = 'Due date';
  const dueDateInput = document.createElement('input');
  dueDateInput.type = 'date';
  if (state.dueDate) dueDateInput.value = state.dueDate;
  dueDateInput.addEventListener('change', () => { state.dueDate = dueDateInput.value || null; });
  dueDateLabel.appendChild(dueDateInput);

  const dueTimeLabel = document.createElement('label');
  dueTimeLabel.textContent = 'Due time';
  const dueTimeInput = document.createElement('input');
  dueTimeInput.type = 'time';
  if (state.dueTime) dueTimeInput.value = state.dueTime;
  dueTimeInput.addEventListener('change', () => { state.dueTime = dueTimeInput.value || null; });
  dueTimeLabel.appendChild(dueTimeInput);

  dueRow.appendChild(dueDateLabel);
  dueRow.appendChild(dueTimeLabel);
  box.appendChild(dueRow);

  const recurLabel = document.createElement('label');
  recurLabel.textContent = 'Repeat';
  const recurSelect = document.createElement('select');
  [['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly']].forEach(([val, text]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if (state.recurrence === val) opt.selected = true;
    recurSelect.appendChild(opt);
  });
  recurSelect.addEventListener('change', () => { state.recurrence = recurSelect.value; });
  recurLabel.appendChild(recurSelect);
  box.appendChild(recurLabel);

  wrap.appendChild(toggle);
  wrap.appendChild(box);

  return { el: wrap, state };
}

/* ============================== Task workspace view ============================== */

function renderTaskWorkspaceView(ws) {
  const container = document.createElement('div');
  container.className = 'task-workspace';

  if (ws.id === 'companies') {
    const banner = document.createElement('div');
    banner.className = 'motivation-banner';
    banner.textContent = MOTIVATION_BANNER_TEXT;
    container.appendChild(banner);
  }

  if (ws.id === 'cpdsa') {
    container.appendChild(renderContestSection());
  }

  // Quick-add stays a single line until focused, so the workspace opens on the
  // list rather than on a tall form.
  const form = document.createElement('form');
  form.className = 'quick-add';

  const row = document.createElement('div');
  row.className = 'quick-add-row';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.placeholder = `Add to ${ws.name}...`;
  titleInput.addEventListener('focus', () => form.classList.add('expanded'));
  row.appendChild(titleInput);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'quick-add-submit';
  submitBtn.setAttribute('aria-label', 'Add task');
  addIcon(submitBtn, 'plus');
  row.appendChild(submitBtn);
  form.appendChild(row);

  const extra = document.createElement('div');
  extra.className = 'quick-add-extra';

  const labelPicker = document.createElement('div');
  labelPicker.className = 'label-picker';
  const selectedLabels = new Set();
  getAllLabels().forEach((label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'label-chip selectable';
    chip.textContent = label;
    chip.addEventListener('click', () => {
      if (selectedLabels.has(label)) { selectedLabels.delete(label); chip.classList.remove('selected'); }
      else { selectedLabels.add(label); chip.classList.add('selected'); }
    });
    labelPicker.appendChild(chip);
  });
  extra.appendChild(labelPicker);

  const details = buildTaskDetailsSection(null);
  extra.appendChild(details.el);
  form.appendChild(extra);

  // Collapse again when focus leaves the whole form and nothing is typed.
  form.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!form.contains(document.activeElement) && !titleInput.value.trim()) {
        form.classList.remove('expanded');
      }
    }, 0);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    addTask(ws.id, title, Array.from(selectedLabels), details.state);
    render();
  });
  container.appendChild(form);

  const filterRow = document.createElement('div');
  filterRow.className = 'filter-row';
  const activeFilter = currentTaskFilter[ws.id] || null;
  ['All', ...getAllLabels()].forEach((f) => {
    const chip = document.createElement('button');
    const isActive = f === 'All' ? !activeFilter : activeFilter === f;
    chip.className = 'filter-chip' + (isActive ? ' active' : '');
    chip.textContent = f;
    chip.addEventListener('click', () => {
      currentTaskFilter[ws.id] = f === 'All' ? null : f;
      render();
    });
    filterRow.appendChild(chip);
  });

  // Sort sits on the same row as the filters — it was a whole row to itself.
  const sortRow = document.createElement('div');
  sortRow.className = 'sort-row';
  const sortSelect = document.createElement('select');
  sortSelect.setAttribute('aria-label', 'Sort tasks');
  const activeSort = currentTaskSort[ws.id] || 'recent';
  [['recent', 'Recent'], ['priority', 'Priority'], ['due', 'Due date']].forEach(([val, text]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if (activeSort === val) opt.selected = true;
    sortSelect.appendChild(opt);
  });
  sortSelect.addEventListener('change', () => { currentTaskSort[ws.id] = sortSelect.value; render(); });
  sortRow.appendChild(sortSelect);

  // Chips scroll; sort is pinned outside the scroll container so it can't be
  // pushed off-screen by a long label list.
  const controls = document.createElement('div');
  controls.className = 'list-controls';
  controls.appendChild(filterRow);
  controls.appendChild(sortRow);
  container.appendChild(controls);

  const list = document.createElement('div');
  list.className = 'task-list';
  let tasks = Store.state.tasks
    .filter((t) => t.workspaceId === ws.id)
    .filter((t) => !activeFilter || t.labels.includes(activeFilter));
  tasks = sortTasks(tasks, activeSort);
  tasks.sort((a, b) => {
    const aDone = isTaskDoneToday(a);
    const bDone = isTaskDoneToday(b);
    return aDone === bDone ? 0 : (aDone ? 1 : -1);
  });

  if (tasks.length === 0) {
    list.appendChild(buildEmptyState(
      'checkSquare',
      activeFilter
        ? `Nothing labelled "${activeFilter}" here.`
        : 'No tasks yet.\nAdd one above, or tap +.',
    ));
  } else {
    tasks.forEach((t) => list.appendChild(renderTaskRow(t)));
  }
  container.appendChild(list);

  return container;
}

function formatDueLabel(t) {
  if (!t.dueDate) return null;
  let label = formatDateLabel(t.dueDate);
  if (t.dueTime) label += ` · ${t.dueTime}`;
  return label;
}

function renderTaskRow(t) {
  const doneToday = isTaskDoneToday(t);
  const isRecurring = t.recurrence && t.recurrence !== 'none';
  const row = document.createElement('div');
  row.className = 'task-row' + (doneToday ? ' done' : '');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'task-check';
  check.checked = doneToday;
  check.addEventListener('change', () => {
    if (isRecurring) toggleTaskCompletionToday(t.id); else toggleTaskDone(t.id);
    render();
  });
  row.appendChild(check);

  const main = document.createElement('div');
  main.className = 'task-main';
  const titleRow = document.createElement('div');
  titleRow.className = 'task-title-row';
  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = t.title;
  titleRow.appendChild(title);
  if (t.priority) {
    const dot = document.createElement('span');
    dot.className = 'priority-dot priority-' + t.priority;
    titleRow.appendChild(dot);
  }
  main.appendChild(titleRow);

  const dueLabel = formatDueLabel(t);
  const streak = isRecurring ? taskStreak(t) : 0;
  if (dueLabel || isRecurring) {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const bits = [];
    if (dueLabel) bits.push(`Due ${dueLabel}`);
    if (isRecurring) bits.push(t.recurrence === 'daily' ? 'Daily' : 'Weekly');
    meta.appendChild(document.createTextNode(bits.join(' · ')));
    if (streak > 0) {
      const badge = document.createElement('span');
      badge.className = 'streak-badge';
      addIcon(badge, 'flame');
      badge.appendChild(document.createTextNode(String(streak)));
      meta.appendChild(badge);
    }
    main.appendChild(meta);
  }

  if (t.labels.length) {
    const labelsEl = document.createElement('div');
    labelsEl.className = 'task-labels';
    t.labels.forEach((l) => {
      const chip = document.createElement('span');
      chip.className = 'label-chip small';
      chip.textContent = l;
      labelsEl.appendChild(chip);
    });
    main.appendChild(labelsEl);
  }
  main.addEventListener('click', () => openEditTaskModal(t));
  row.appendChild(main);

  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn tiny';
  delBtn.setAttribute('aria-label', 'Delete task');
  addIcon(delBtn, 'close');
  delBtn.addEventListener('click', () => { if (confirm('Delete this task?')) { deleteTask(t.id); render(); } });
  row.appendChild(delBtn);

  return row;
}

function openEditTaskModal(t) {
  const body = document.createElement('form');
  body.className = 'modal-form';

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.value = t.title;
  titleLabel.appendChild(titleInput);
  body.appendChild(titleLabel);

  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Notes';
  const notesInput = document.createElement('textarea');
  notesInput.value = t.notes || '';
  notesLabel.appendChild(notesInput);
  body.appendChild(notesLabel);

  const labelPicker = document.createElement('div');
  labelPicker.className = 'label-picker';
  const selected = new Set(t.labels);
  getAllLabels().forEach((label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'label-chip selectable' + (selected.has(label) ? ' selected' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      if (selected.has(label)) { selected.delete(label); chip.classList.remove('selected'); }
      else { selected.add(label); chip.classList.add('selected'); }
    });
    labelPicker.appendChild(chip);
  });
  body.appendChild(labelPicker);

  const details = buildTaskDetailsSection(t);
  body.appendChild(details.el);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn-danger';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => {
    if (confirm('Delete this task?')) { deleteTask(t.id); closeModal(); render(); }
  });
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save changes';
  footer.appendChild(delBtn);
  footer.appendChild(saveBtn);
  body.appendChild(footer);

  openModal('Edit task', body);

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    updateTask(t.id, {
      title,
      notes: notesInput.value.trim(),
      labels: Array.from(selected),
      priority: details.state.priority,
      dueDate: details.state.dueDate,
      dueTime: details.state.dueTime,
      recurrence: details.state.recurrence,
    });
    closeModal();
    render();
  });
}

/* ============================== Timetable view ============================== */

function renderTimetableView() {
  const container = document.createElement('div');
  container.className = 'timetable-workspace';

  const switcher = document.createElement('div');
  switcher.className = 'date-switcher';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'icon-btn';
  prevBtn.setAttribute('aria-label', 'Previous day');
  addIcon(prevBtn, 'chevronLeft');
  prevBtn.addEventListener('click', () => { currentTimetableDate = addDaysStr(currentTimetableDate, -1); render(); });

  const dateLabel = document.createElement('div');
  dateLabel.className = 'date-label';
  dateLabel.innerHTML = `<div class="date-main">${escapeHtml(formatDateLabel(currentTimetableDate))}</div><div class="date-sub">${escapeHtml(currentTimetableDate)}</div>`;
  // Tapping the date jumps back to today — the common case after browsing ahead.
  dateLabel.style.cursor = 'pointer';
  dateLabel.title = 'Jump to today';
  dateLabel.addEventListener('click', () => { currentTimetableDate = todayStr(); render(); });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'icon-btn';
  nextBtn.setAttribute('aria-label', 'Next day');
  addIcon(nextBtn, 'chevronRight');
  nextBtn.addEventListener('click', () => { currentTimetableDate = addDaysStr(currentTimetableDate, 1); render(); });

  switcher.appendChild(prevBtn);
  switcher.appendChild(dateLabel);
  switcher.appendChild(nextBtn);
  container.appendChild(switcher);

  const blocks = Store.state.blocks
    .filter((b) => b.date === currentTimetableDate)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  const isToday = currentTimetableDate === todayStr();
  if (isToday && blocks.length) container.appendChild(renderNowCard(blocks));

  const actions = document.createElement('div');
  actions.className = 'action-row';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn-outline';
  addIcon(loadBtn, 'inbox');
  loadBtn.appendChild(document.createTextNode('Load template'));
  loadBtn.addEventListener('click', () => loadTemplateIntoDay(currentTimetableDate));

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-outline';
  saveBtn.textContent = 'Save as template';
  saveBtn.addEventListener('click', () => saveDayAsTemplate(currentTimetableDate));

  actions.appendChild(loadBtn);
  actions.appendChild(saveBtn);
  container.appendChild(actions);

  if (blocks.length === 0) {
    container.appendChild(buildEmptyState(
      'calendar',
      'Nothing planned yet.\nTap + to add a block, or load your saved template.',
    ));
    return container;
  }

  container.appendChild(renderTimeline(blocks, isToday));
  return container;
}

/** What's happening right now, and what's next — the reason to open the app. */
function renderNowCard(blocks) {
  const now = nowMinutes();
  const current = blocks.find((b) => {
    const s = minutesOf(b.start);
    const e = minutesOf(b.end);
    return Number.isFinite(s) && Number.isFinite(e) && now >= s && now < e;
  });
  const next = blocks.find((b) => minutesOf(b.start) > now);

  const card = document.createElement('div');
  card.className = 'now-card' + (current ? '' : ' is-idle');

  const kicker = document.createElement('div');
  kicker.className = 'now-kicker';
  const pulse = document.createElement('span');
  pulse.className = 'now-pulse';
  kicker.appendChild(pulse);
  kicker.appendChild(document.createTextNode(current ? 'Now' : 'Free right now'));
  card.appendChild(kicker);

  const title = document.createElement('div');
  title.className = 'now-title';

  if (current) {
    title.textContent = current.title;
    card.appendChild(title);

    const start = minutesOf(current.start);
    const end = minutesOf(current.end);
    const meta = document.createElement('div');
    meta.className = 'now-meta';
    meta.textContent = `${formatTime12(current.start)} – ${formatTime12(current.end)} · `
      + `${formatDuration(end - now)} left`;
    card.appendChild(meta);

    const track = document.createElement('div');
    track.className = 'now-progress';
    const fill = document.createElement('div');
    fill.className = 'now-progress-fill';
    const pct = end > start ? ((now - start) / (end - start)) * 100 : 0;
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    track.appendChild(fill);
    card.appendChild(track);

    const doneSubs = current.subtasks.filter((s) => s.done).length;
    if (current.subtasks.length) {
      const subs = document.createElement('div');
      subs.className = 'now-next';
      subs.textContent = `${doneSubs}/${current.subtasks.length} subtasks done`;
      card.appendChild(subs);
    }
  } else {
    title.textContent = next ? 'Nothing scheduled right now' : 'Day complete';
    card.appendChild(title);
  }

  if (next) {
    const nextEl = document.createElement('div');
    nextEl.className = 'now-next';
    const label = document.createElement('span');
    label.textContent = 'Next';
    const b = document.createElement('b');
    b.textContent = next.title;
    const when = document.createElement('span');
    when.textContent = `· ${formatTime12(next.start)}`;
    nextEl.appendChild(label);
    nextEl.appendChild(b);
    nextEl.appendChild(when);
    card.appendChild(nextEl);
  }

  return card;
}

/** Blocks on a time rail: past dimmed, current highlighted, gaps called out. */
function renderTimeline(blocks, isToday) {
  const now = nowMinutes();
  const timeline = document.createElement('div');
  timeline.className = 'timeline';

  blocks.forEach((b, i) => {
    const start = minutesOf(b.start);
    const end = minutesOf(b.end);

    const item = document.createElement('div');
    item.className = 'tl-item';
    if (isToday && Number.isFinite(end)) {
      if (now >= start && now < end) item.classList.add('is-now');
      else if (now >= end) item.classList.add('is-past');
    }

    const time = document.createElement('div');
    time.className = 'tl-time';
    time.textContent = formatTime12(b.start).replace(' ', ' ');
    const dur = document.createElement('small');
    dur.textContent = formatDuration(end - start);
    time.appendChild(dur);
    item.appendChild(time);

    const dot = document.createElement('div');
    dot.className = 'tl-dot';
    item.appendChild(dot);

    item.appendChild(renderBlockCard(b));
    timeline.appendChild(item);

    // Call out any gap over 20 minutes — unplanned time is the thing worth seeing.
    const nextBlock = blocks[i + 1];
    if (nextBlock) {
      const gap = minutesOf(nextBlock.start) - end;
      if (Number.isFinite(gap) && gap >= 20) {
        const gapEl = document.createElement('div');
        gapEl.className = 'tl-gap';
        gapEl.textContent = `${formatDuration(gap)} free`;
        timeline.appendChild(gapEl);
      }
    }
  });

  return timeline;
}

/** Shared empty state: icon + message (newlines become line breaks). */
function buildEmptyState(iconName, message) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  const ic = icon(iconName);
  if (ic) el.appendChild(ic);
  message.split('\n').forEach((line, i) => {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
  return el;
}

function renderBlockCard(b) {
  const card = document.createElement('div');
  card.className = 'block-card';

  const header = document.createElement('div');
  header.className = 'block-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'block-title-row';
  const titleEl = document.createElement('div');
  titleEl.className = 'block-title';
  titleEl.textContent = b.title;
  titleRow.appendChild(titleEl);

  const durationEl = document.createElement('div');
  durationEl.className = 'block-duration';
  durationEl.textContent = `${formatTime12(b.start)} – ${formatTime12(b.end)}`;
  titleRow.appendChild(durationEl);

  const linkedTask = b.taskId ? Store.state.tasks.find((t) => t.id === b.taskId) : null;
  if (linkedTask) {
    const badge = document.createElement('div');
    badge.className = 'linked-badge';
    addIcon(badge, 'link');
    badge.appendChild(document.createTextNode(linkedTask.title));
    titleRow.appendChild(badge);
  }
  header.appendChild(titleRow);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'block-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn small ghost';
  editBtn.setAttribute('aria-label', 'Edit block');
  addIcon(editBtn, 'pencil');
  editBtn.addEventListener('click', () => openBlockModal(b));
  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn small ghost';
  delBtn.setAttribute('aria-label', 'Delete block');
  addIcon(delBtn, 'close');
  delBtn.addEventListener('click', () => { if (confirm('Delete this block?')) { deleteBlock(b.id); render(); } });
  actionsEl.appendChild(editBtn);
  actionsEl.appendChild(delBtn);
  header.appendChild(actionsEl);

  card.appendChild(header);

  const subList = document.createElement('div');
  subList.className = 'subtask-list';
  b.subtasks.forEach((st) => {
    const row = document.createElement('div');
    row.className = 'subtask-row' + (st.done ? ' done' : '');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = st.done;
    check.addEventListener('change', () => { toggleSubtaskDone(b.id, st.id); render(); });
    const label = document.createElement('span');
    label.className = 'subtask-title';
    label.textContent = st.title;
    const del = document.createElement('button');
    del.className = 'icon-btn tiny';
    del.setAttribute('aria-label', 'Delete subtask');
    addIcon(del, 'close');
    del.addEventListener('click', () => { deleteSubtask(b.id, st.id); render(); });
    row.appendChild(check);
    row.appendChild(label);
    row.appendChild(del);
    subList.appendChild(row);
  });
  card.appendChild(subList);

  const subForm = document.createElement('form');
  subForm.className = 'add-subtask-form';
  const subInput = document.createElement('input');
  subInput.type = 'text';
  subInput.className = 'subtask-input';
  subInput.placeholder = 'Add a subtask...';
  const subBtn = document.createElement('button');
  subBtn.type = 'submit';
  subBtn.className = 'btn-mini';
  subBtn.setAttribute('aria-label', 'Add subtask');
  addIcon(subBtn, 'plus');
  subForm.appendChild(subInput);
  subForm.appendChild(subBtn);
  subForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = subInput.value.trim();
    if (!title) return;
    addSubtask(b.id, title);
    render();
  });
  card.appendChild(subForm);

  return card;
}

function openBlockModal(block) {
  const isEdit = !!block;
  const body = document.createElement('form');
  body.className = 'modal-form';

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.value = block ? block.title : '';
  titleLabel.appendChild(titleInput);
  body.appendChild(titleLabel);

  const candidateTasks = Store.state.tasks.filter((t) => {
    if (isTaskDoneToday(t)) return false;
    if (t.labels.includes('Today') || t.labels.includes('Important') || t.labels.includes('Tomorrow')) return true;
    if (t.dueDate === currentTimetableDate) return true;
    return false;
  });
  let select = null;
  if (candidateTasks.length) {
    const pickLabel = document.createElement('label');
    pickLabel.textContent = 'Or pick a task (Today / Tomorrow / Important)';
    select = document.createElement('select');
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— none —';
    select.appendChild(noneOpt);
    candidateTasks.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      const wsName = getWorkspace(t.workspaceId)?.name || '';
      opt.textContent = `${wsName}: ${t.title}`;
      if (block && block.taskId === t.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      if (select.value) {
        const t = Store.state.tasks.find((x) => x.id === select.value);
        if (t) titleInput.value = t.title;
      }
    });
    pickLabel.appendChild(select);
    body.appendChild(pickLabel);
  }

  const timeRow = document.createElement('div');
  timeRow.className = 'time-row';
  const startLabel = document.createElement('label');
  startLabel.textContent = 'Start';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.required = true;
  startInput.value = block ? block.start : '09:00';
  startLabel.appendChild(startInput);
  const endLabel = document.createElement('label');
  endLabel.textContent = 'End';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.required = true;
  endInput.value = block ? block.end : '10:00';
  endLabel.appendChild(endInput);
  timeRow.appendChild(startLabel);
  timeRow.appendChild(endLabel);
  body.appendChild(timeRow);

  const errorEl = document.createElement('p');
  errorEl.className = 'form-error';
  body.appendChild(errorEl);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  if (isEdit) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (confirm('Delete this block?')) { deleteBlock(block.id); closeModal(); render(); }
    });
    footer.appendChild(delBtn);
  }
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = isEdit ? 'Save changes' : 'Add block';
  footer.appendChild(saveBtn);
  body.appendChild(footer);

  openModal(isEdit ? 'Edit block' : 'New block', body);

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const start = startInput.value;
    const end = endInput.value;
    const taskId = select ? (select.value || null) : null;
    if (!title || !start || !end) return;
    if (end <= start) { errorEl.textContent = 'End time must be after start time.'; return; }
    if (isEdit) {
      updateBlock(block.id, { title, start, end, taskId });
    } else {
      addBlock(currentTimetableDate, title, start, end, taskId);
    }
    closeModal();
    render();
  });
}

/* ============================== Stats view ============================== */

function buildStatTile(label, value) {
  const tile = document.createElement('div');
  tile.className = 'stat-tile';
  const v = document.createElement('div');
  v.className = 'stat-value';
  v.textContent = value;
  const l = document.createElement('div');
  l.className = 'stat-label';
  l.textContent = label;
  tile.appendChild(v);
  tile.appendChild(l);
  return tile;
}

function buildProgressRow(label, valueText, pct, iconEl) {
  const row = document.createElement('div');
  row.className = 'progress-row';
  const top = document.createElement('div');
  top.className = 'progress-row-top';
  const labelEl = document.createElement('span');
  labelEl.className = 'progress-row-label';
  if (iconEl) labelEl.appendChild(iconEl);
  labelEl.appendChild(document.createTextNode(label));
  const valueEl = document.createElement('span');
  valueEl.className = 'hint';
  valueEl.textContent = valueText;
  top.appendChild(labelEl);
  top.appendChild(valueEl);
  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  track.appendChild(fill);
  row.appendChild(top);
  row.appendChild(track);
  return row;
}

function renderStatsView() {
  const container = document.createElement('div');
  container.className = 'stats-view';

  const taskWorkspaces = Store.state.workspaces.filter((w) => w.type === 'tasks');
  const totalTasks = Store.state.tasks.length;
  const doneNow = Store.state.tasks.filter((t) => isTaskDoneToday(t)).length;

  const weekCutoff = Date.now() - 6 * 24 * 60 * 60 * 1000;
  let completionsThisWeek = 0;
  Store.state.tasks.forEach((t) => {
    if (t.recurrence === 'none') {
      if (t.completedAt && t.completedAt >= weekCutoff) completionsThisWeek += 1;
    } else {
      Object.keys(t.completions || {}).forEach((d) => {
        const [y, m, dd] = d.split('-').map(Number);
        if (new Date(y, m - 1, dd).getTime() >= weekCutoff) completionsThisWeek += 1;
      });
    }
  });

  const tilesRow = document.createElement('div');
  tilesRow.className = 'stat-grid';
  tilesRow.appendChild(buildStatTile('Tasks tracked', String(totalTasks)));
  tilesRow.appendChild(buildStatTile('Checked off now', String(doneNow)));
  tilesRow.appendChild(buildStatTile('Done this week', String(completionsThisWeek)));
  container.appendChild(tilesRow);

  const wsSection = document.createElement('div');
  wsSection.className = 'stats-section';
  const wsHeading = document.createElement('h3');
  wsHeading.textContent = 'By workspace';
  wsSection.appendChild(wsHeading);
  if (!taskWorkspaces.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No workspaces yet.';
    wsSection.appendChild(p);
  }
  taskWorkspaces.forEach((ws) => {
    const wsTasks = Store.state.tasks.filter((t) => t.workspaceId === ws.id);
    const wsDone = wsTasks.filter((t) => isTaskDoneToday(t)).length;
    const pct = wsTasks.length ? Math.round((wsDone / wsTasks.length) * 100) : 0;
    wsSection.appendChild(buildProgressRow(
      ws.name,
      wsTasks.length ? `${wsDone}/${wsTasks.length}` : 'No tasks',
      pct,
      workspaceIcon(ws),
    ));
  });
  container.appendChild(wsSection);

  const streakSection = document.createElement('div');
  streakSection.className = 'stats-section';
  const streakHeading = document.createElement('h3');
  streakHeading.textContent = 'Streaks';
  streakSection.appendChild(streakHeading);
  const recurringTasks = Store.state.tasks
    .filter((t) => t.recurrence && t.recurrence !== 'none')
    .map((t) => ({ t, streak: taskStreak(t) }))
    .sort((a, b) => b.streak - a.streak);
  if (!recurringTasks.length) {
    streakSection.appendChild(buildEmptyState(
      'flame',
      'No streaks yet.\nSet a task to repeat Daily or Weekly to start one.',
    ));
  } else {
    recurringTasks.forEach(({ t, streak }) => {
      const row = document.createElement('div');
      row.className = 'streak-row';
      const wsName = getWorkspace(t.workspaceId)?.name || '';
      const left = document.createElement('span');
      left.textContent = t.title + ' ';
      const wsTag = document.createElement('span');
      wsTag.className = 'hint';
      wsTag.textContent = `(${wsName})`;
      left.appendChild(wsTag);
      const right = document.createElement('span');
      right.className = 'streak-count';
      if (streak > 0) {
        addIcon(right, 'flame');
        right.appendChild(document.createTextNode(String(streak)));
      } else {
        right.textContent = '—';
        right.style.color = 'var(--text-faint)';
      }
      row.appendChild(left);
      row.appendChild(right);
      streakSection.appendChild(row);
    });
  }
  container.appendChild(streakSection);

  const ttSection = document.createElement('div');
  ttSection.className = 'stats-section';
  const ttHeading = document.createElement('h3');
  ttHeading.textContent = 'Timetable — last 7 days';
  ttSection.appendChild(ttHeading);
  let plannedDays = 0;
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDaysStr(todayStr(), -i);
    if (Store.state.blocks.some((b) => b.date === d)) plannedDays += 1;
  }
  ttSection.appendChild(buildProgressRow('Days planned', `${plannedDays}/7`, Math.round((plannedDays / 7) * 100)));
  container.appendChild(ttSection);

  return container;
}

/* ============================== Search ============================== */

function openSearchModal() {
  const body = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search tasks and timetable blocks...';
  input.className = 'search-input';
  const results = document.createElement('div');
  results.className = 'search-results';
  body.appendChild(input);
  body.appendChild(results);

  function runSearch(query) {
    results.innerHTML = '';
    const q = query.trim().toLowerCase();
    if (!q) {
      results.appendChild(buildEmptyState('search', 'Start typing to search across every workspace.'));
      return;
    }
    const taskMatches = Store.state.tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q),
    );
    const blockMatches = Store.state.blocks.filter((b) => b.title.toLowerCase().includes(q));

    if (!taskMatches.length && !blockMatches.length) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No matches.';
      results.appendChild(p);
      return;
    }

    if (taskMatches.length) {
      const heading = document.createElement('div');
      heading.className = 'search-group-heading';
      heading.textContent = 'Tasks';
      results.appendChild(heading);
      taskMatches.forEach((t) => {
        const wsName = getWorkspace(t.workspaceId)?.name || '';
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'search-result-row';
        const left = document.createElement('span');
        left.textContent = t.title;
        const right = document.createElement('span');
        right.className = 'hint';
        right.textContent = wsName;
        row.appendChild(left);
        row.appendChild(right);
        row.addEventListener('click', () => { closeModal(); setWorkspace(t.workspaceId); });
        results.appendChild(row);
      });
    }

    if (blockMatches.length) {
      const heading = document.createElement('div');
      heading.className = 'search-group-heading';
      heading.textContent = 'Timetable blocks';
      results.appendChild(heading);
      blockMatches.forEach((b) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'search-result-row';
        const left = document.createElement('span');
        left.textContent = b.title;
        const right = document.createElement('span');
        right.className = 'hint';
        right.textContent = `${formatDateLabel(b.date)} · ${b.start}`;
        row.appendChild(left);
        row.appendChild(right);
        row.addEventListener('click', () => {
          closeModal();
          currentTimetableDate = b.date;
          setWorkspace('timetable');
        });
        results.appendChild(row);
      });
    }
  }

  input.addEventListener('input', () => runSearch(input.value));
  openModal('Search', body);
  runSearch('');
  input.focus();
}

/* ============================== Settings ============================== */

function buildSyncSection() {
  const section = document.createElement('div');
  section.className = 'settings-section';
  const heading = document.createElement('h3');
  heading.textContent = 'Sync across devices';
  section.appendChild(heading);

  if (!firebaseReady) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Not set up yet. Create a free Firebase project and fill in web/firebase-config.js '
      + 'to enable cross-device sync — see FIREBASE_SETUP.md. Until then everything stays local-only on '
      + 'this device (export/import backup below still works).';
    section.appendChild(p);
    return section;
  }

  if (currentUser) {
    const status = document.createElement('p');
    status.className = 'hint';
    let when = 'No changes pushed yet this session.';
    if (lastSyncedAt) {
      when = `Last synced ${new Date(lastSyncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`;
    }
    status.textContent = `Signed in as ${currentUser.email}. ${when} `
      + 'Every device signed into this account stays in step.';
    section.appendChild(status);
    if (lastSyncError) {
      const err = document.createElement('p');
      err.className = 'form-error';
      err.textContent = `Last sync error: ${lastSyncError}`;
      section.appendChild(err);
    }
    const signOutBtn = document.createElement('button');
    signOutBtn.className = 'btn-outline';
    signOutBtn.textContent = 'Sign out';
    signOutBtn.addEventListener('click', async () => {
      await signOutUser();
      closeModal();
      openSettingsModal();
    });
    section.appendChild(signOutBtn);
    return section;
  }

  const form = document.createElement('form');
  form.className = 'modal-form';

  const emailLabel = document.createElement('label');
  emailLabel.textContent = 'Email';
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.required = true;
  emailLabel.appendChild(emailInput);

  const passLabel = document.createElement('label');
  passLabel.textContent = 'Password (6+ characters)';
  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.required = true;
  passInput.minLength = 6;
  passLabel.appendChild(passInput);

  const errorEl = document.createElement('p');
  errorEl.className = 'form-error';

  const btnRow = document.createElement('div');
  btnRow.className = 'modal-footer';
  const signInBtn = document.createElement('button');
  signInBtn.type = 'button';
  signInBtn.className = 'btn-outline';
  signInBtn.textContent = 'Sign in';
  const signUpBtn = document.createElement('button');
  signUpBtn.type = 'submit';
  signUpBtn.className = 'btn-primary';
  signUpBtn.textContent = 'Create account';
  btnRow.appendChild(signInBtn);
  btnRow.appendChild(signUpBtn);

  form.appendChild(emailLabel);
  form.appendChild(passLabel);
  form.appendChild(errorEl);
  form.appendChild(btnRow);

  async function handle(action) {
    errorEl.textContent = '';
    try {
      await action(emailInput.value.trim(), passInput.value);
      closeModal();
      openSettingsModal();
    } catch (e) {
      errorEl.textContent = (e && e.message) || 'Something went wrong.';
    }
  }

  signInBtn.addEventListener('click', () => handle(signIn));
  form.addEventListener('submit', (e) => { e.preventDefault(); handle(signUp); });

  section.appendChild(form);
  return section;
}

function openSettingsModal() {
  const s = Store.state.settings;
  const body = document.createElement('div');

  const appearance = document.createElement('div');
  appearance.className = 'settings-section';
  appearance.innerHTML = '<h3>Appearance</h3>';
  const seg = document.createElement('div');
  seg.className = 'segmented';
  ['system', 'light', 'dark'].forEach((mode) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn' + (s.theme === mode ? ' active' : '');
    btn.textContent = mode[0].toUpperCase() + mode.slice(1);
    btn.addEventListener('click', () => {
      Store.state.settings.theme = mode;
      Store.save();
      applyTheme();
      closeModal();
      openSettingsModal();
    });
    seg.appendChild(btn);
  });
  appearance.appendChild(seg);
  body.appendChild(appearance);

  body.appendChild(buildSyncSection());

  const reminder = document.createElement('div');
  reminder.className = 'settings-section';
  reminder.innerHTML = '<h3>Alarms</h3>';

  const alarmList = document.createElement('div');
  alarmList.className = 'alarm-list';

  function renderAlarmRow(alarm) {
    const row = document.createElement('div');
    row.className = 'alarm-row';

    const enabledCheck = document.createElement('input');
    enabledCheck.type = 'checkbox';
    enabledCheck.checked = alarm.enabled;
    enabledCheck.addEventListener('change', (e) => {
      alarm.enabled = e.target.checked;
      Store.save();
      if (e.target.checked) requestNotificationPermission();
    });
    row.appendChild(enabledCheck);

    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'alarm-time-input';
    timeInput.value = alarm.time;
    timeInput.addEventListener('change', (e) => {
      alarm.time = e.target.value;
      Store.save();
    });
    row.appendChild(timeInput);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'alarm-label';
    labelSpan.textContent = alarm.label;
    row.appendChild(labelSpan);

    if (alarm.id !== 'plan-tomorrow') {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn tiny';
      delBtn.setAttribute('aria-label', 'Delete alarm');
      addIcon(delBtn, 'close');
      delBtn.addEventListener('click', () => {
        Store.state.settings.alarms = Store.state.settings.alarms.filter((a) => a.id !== alarm.id);
        Store.save();
        closeModal();
        openSettingsModal();
      });
      row.appendChild(delBtn);
    }

    return row;
  }

  Store.state.settings.alarms.forEach((alarm) => alarmList.appendChild(renderAlarmRow(alarm)));
  reminder.appendChild(alarmList);

  const addForm = document.createElement('form');
  addForm.className = 'add-alarm-form';
  const addTime = document.createElement('input');
  addTime.type = 'time';
  addTime.value = '08:00';
  addForm.appendChild(addTime);
  const addLabel = document.createElement('input');
  addLabel.type = 'text';
  addLabel.placeholder = 'Alarm label...';
  addLabel.required = true;
  addForm.appendChild(addLabel);
  const addBtn = document.createElement('button');
  addBtn.type = 'submit';
  addBtn.className = 'btn-mini';
  addBtn.textContent = 'Add alarm';
  addForm.appendChild(addBtn);
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const label = addLabel.value.trim();
    if (!label) return;
    Store.state.settings.alarms.push({ id: uid(), label, time: addTime.value, enabled: true, checkPlanning: false });
    Store.save();
    requestNotificationPermission();
    closeModal();
    openSettingsModal();
  });
  reminder.appendChild(addForm);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = "Fires while this app/tab is open. Browsers can't guarantee notifications when fully closed — install this to your home screen to keep it running longer, but it isn't a substitute for a native app's background notifications.";
  reminder.appendChild(hint);
  body.appendChild(reminder);

  const data = document.createElement('div');
  data.className = 'settings-section';
  data.innerHTML = '<h3>Data</h3>';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-outline';
  exportBtn.textContent = 'Export backup (.json)';
  exportBtn.addEventListener('click', exportBackup);
  data.appendChild(exportBtn);

  const importLabel = document.createElement('label');
  importLabel.className = 'btn-outline file-label';
  importLabel.textContent = 'Import backup';
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json';
  importInput.hidden = true;
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importBackup(file);
  });
  importLabel.appendChild(importInput);
  data.appendChild(importLabel);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-danger';
  clearBtn.textContent = 'Clear all data';
  clearBtn.addEventListener('click', () => {
    if (confirm('Permanently delete everything? This cannot be undone.')) {
      Store.state = defaultState();
      Store.save();
      closeModal();
      currentWorkspaceId = Store.state.workspaces[0].id;
      render();
    }
  });
  data.appendChild(clearBtn);

  body.appendChild(data);

  const about = document.createElement('div');
  about.className = 'settings-section';
  about.innerHTML = '<h3>About</h3><p class="hint">Personal OS — local-first. Your data never leaves this device unless you export it.</p>';
  body.appendChild(about);

  openModal('Settings', body);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personal-os-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  if (file && file.size > 20 * 1024 * 1024) {
    alert('That file is too large to be a Personal OS backup.');
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => alert('Could not read that file.');
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      alert('Could not read that file — it is not valid JSON.');
      return;
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.workspaces) || !Array.isArray(data.tasks)) {
      alert('That JSON is not a Personal OS backup (missing workspaces/tasks).');
      return;
    }
    const summary = `${data.workspaces.length} workspaces, ${data.tasks.length} tasks, `
      + `${Array.isArray(data.blocks) ? data.blocks.length : 0} timetable blocks`;
    if (!confirm(`Replace ALL current data with this backup?\n\nBackup contains: ${summary}\n\nThis cannot be undone.`)) return;
    const previous = Store.state;
    try {
      Store.state = data;
      Store.migrate();
      Store.save();
      closeModal();
      render();
      showToast('Backup imported.', 'success');
    } catch (e) {
      // Roll back rather than leaving the app on a half-applied import.
      Store.state = previous;
      Store.save();
      render();
      alert('That backup could not be applied — your existing data was kept.');
    }
  };
  reader.readAsText(file);
}

/* ============================== Reminder (best-effort) ============================== */

let reminderInterval = null;
const lastAlarmFiredDate = {};

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function startReminderLoop() {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(checkReminder, 30000);
  checkReminder();
}

function checkReminder() {
  const alarms = Store.state.settings.alarms || [];
  if (!alarms.some((a) => a.enabled)) return;
  const now = new Date();
  const nowStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const today = todayStr();
  alarms.forEach((alarm) => {
    if (!alarm.enabled || alarm.time !== nowStr || lastAlarmFiredDate[alarm.id] === today) return;
    lastAlarmFiredDate[alarm.id] = today;
    if (alarm.checkPlanning) {
      const tomorrow = addDaysStr(today, 1);
      const planned = Store.state.blocks.some((b) => b.date === tomorrow);
      if (planned) return;
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alarm.label, alarm.checkPlanning ? { body: "You haven't built tomorrow's timetable yet." } : undefined);
    }
  });
}

/* ============================== Theme ============================== */

function applyTheme() {
  const mode = Store.state.settings.theme;
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

/* ============================== Nudge banner ============================== */

function renderNudgeBanner() {
  const el = document.getElementById('nudgeBanner');
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  const planned = Store.state.blocks.some((b) => b.date === tomorrow);
  if (planned) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = '';
  const ws = getWorkspace(currentWorkspaceId);
  const alreadyHere = ws && ws.type === 'timetable' && currentTimetableDate === tomorrow;
  if (alreadyHere) {
    el.appendChild(document.createTextNode("Tomorrow isn't planned yet — add your first block."));
    return;
  }
  el.appendChild(document.createTextNode("Tomorrow's timetable isn't planned yet."));
  // Telling the user to "open the Timetable workspace" is a worse affordance
  // than just taking them there.
  const go = document.createElement('button');
  go.className = 'btn-mini';
  go.textContent = 'Plan it';
  go.addEventListener('click', () => {
    currentTimetableDate = tomorrow;
    setWorkspace('timetable');
  });
  el.appendChild(go);
}

/* ============================== Root render ============================== */

function render() {
  const content = document.getElementById('content');
  try {
    renderNudgeBanner();
    renderWorkspaceNav();
    let ws = getWorkspace(currentWorkspaceId);
    content.innerHTML = '';
    if (!ws) {
      // Fall back to the first workspace rather than recursing — a stale
      // last-workspace id used to blank the screen on load.
      ws = Store.state.workspaces[0];
      if (!ws) throw new Error('no workspaces');
      currentWorkspaceId = ws.id;
      renderWorkspaceNav();
    }
    if (ws.type === 'timetable') content.appendChild(renderTimetableView());
    else if (ws.type === 'stats') content.appendChild(renderStatsView());
    else content.appendChild(renderTaskWorkspaceView(ws));
  } catch (err) {
    renderErrorState(content, err);
  }
}

/** Last resort so a bad record shows a recoverable screen instead of a blank page. */
function renderErrorState(content, err) {
  if (!content) return;
  content.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'error-state';

  const heading = document.createElement('h3');
  heading.textContent = 'Something went wrong rendering this view';
  box.appendChild(heading);

  const detail = document.createElement('p');
  detail.className = 'error-detail';
  detail.textContent = (err && err.message) ? String(err.message) : 'Unknown error';
  box.appendChild(detail);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Your data is still saved. Export a backup before trying anything else.';
  box.appendChild(hint);

  const actions = document.createElement('div');
  actions.className = 'action-row';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-primary';
  exportBtn.textContent = 'Export backup';
  exportBtn.addEventListener('click', exportBackup);
  actions.appendChild(exportBtn);

  const homeBtn = document.createElement('button');
  homeBtn.className = 'btn-outline';
  homeBtn.textContent = 'Go to first workspace';
  homeBtn.addEventListener('click', () => {
    const first = Store.state.workspaces && Store.state.workspaces[0];
    if (first) setWorkspace(first.id);
  });
  actions.appendChild(homeBtn);

  box.appendChild(actions);
  content.appendChild(box);
  if (err) console.error('Personal OS render error:', err);
}

/* ============================== Init ============================== */

document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  applyTheme();
  const settingsBtn = document.getElementById('settingsBtn');
  const searchBtn = document.getElementById('searchBtn');
  addIcon(searchBtn, 'search');
  addIcon(settingsBtn, 'settings');
  settingsBtn.addEventListener('click', openSettingsModal);
  searchBtn.addEventListener('click', openSearchModal);
  render();
  // The "Now" card and past/current block styling are time-dependent, so the
  // timetable has to re-render as the day moves even if nothing is touched.
  setInterval(() => {
    const ws = getWorkspace(currentWorkspaceId);
    if (ws && ws.type === 'timetable' && !document.getElementById('modalRoot').firstChild) render();
  }, 60000);
  startReminderLoop();
  initSync();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const topbar = document.querySelector('.topbar');
  const updateTopbarShadow = () => topbar.classList.toggle('scrolled', window.scrollY > 2);
  window.addEventListener('scroll', updateTopbarShadow, { passive: true });
  updateTopbarShadow();
});
