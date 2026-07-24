'use strict';

import {
  firebaseReady, onAuthChange, signUp, signIn, signOutUser, watchUserDoc, pushState,
} from './sync.js';

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
    if (!Array.isArray(this.state.labels)) this.state.labels = [...DEFAULT_LABELS];
    if (!Array.isArray(this.state.template)) this.state.template = [];
    if (!this.state.settings) this.state.settings = defaultState().settings;
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
      if (!t.completions) t.completions = {};
      if (t.completedAt === undefined) t.completedAt = t.done ? (t.createdAt || Date.now()) : null;
      if (t.notes === undefined) t.notes = '';
    });
    this.state.version = 2;
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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

function schedulePush() {
  if (!currentUser || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushState(currentUser.uid, Store.state)
      .then(() => { lastSyncError = null; })
      .catch((e) => { lastSyncError = e.message || String(e); });
  }, 600);
}
Store.afterSave = schedulePush;

async function initSync() {
  if (!firebaseReady) return;
  try {
    await onAuthChange(async (user) => {
      currentUser = user;
      if (user) {
        try {
          await watchUserDoc(user.uid, (remoteData) => {
            applyingRemote = true;
            if (remoteData) {
              Store.state = remoteData;
              Store.migrate();
              Store.save();
            } else {
              // First sign-in on this account: seed the cloud with what's local.
              pushState(user.uid, Store.state).catch((e) => { lastSyncError = e.message || String(e); });
            }
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
  closeBtn.textContent = '✕';
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

function renderWorkspaceNav() {
  const nav = document.getElementById('workspaceNav');
  nav.innerHTML = '';
  Store.state.workspaces.forEach((ws) => {
    const chip = document.createElement('button');
    chip.className = 'ws-chip' + (ws.id === currentWorkspaceId ? ' active' : '');
    chip.innerHTML = `<span>${ws.icon || '📁'}</span><span>${escapeHtml(ws.name)}</span>`;
    chip.addEventListener('click', () => setWorkspace(ws.id));
    nav.appendChild(chip);
  });
  const addChip = document.createElement('button');
  addChip.className = 'ws-chip ws-add';
  addChip.textContent = '+ Workspace';
  addChip.addEventListener('click', openAddWorkspaceModal);
  nav.appendChild(addChip);
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
  toggle.className = 'details-toggle';
  const hasDetails = task && (task.priority || task.dueDate || (task.recurrence && task.recurrence !== 'none'));
  toggle.textContent = hasDetails ? '– Priority, due date, repeat' : '+ Priority, due date, repeat';

  const box = document.createElement('div');
  box.className = 'details-box';
  box.style.display = hasDetails ? 'flex' : 'none';

  toggle.addEventListener('click', () => {
    const showing = box.style.display !== 'none';
    box.style.display = showing ? 'none' : 'flex';
    toggle.textContent = showing ? '+ Priority, due date, repeat' : '– Priority, due date, repeat';
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

  const form = document.createElement('form');
  form.className = 'add-task-form';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.placeholder = `Add a task in ${ws.name}...`;
  form.appendChild(titleInput);

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
  form.appendChild(labelPicker);

  const details = buildTaskDetailsSection(null);
  form.appendChild(details.el);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn-primary';
  submitBtn.textContent = 'Add task';
  form.appendChild(submitBtn);

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
  container.appendChild(filterRow);

  const sortRow = document.createElement('div');
  sortRow.className = 'sort-row';
  const sortLabel = document.createElement('span');
  sortLabel.className = 'sort-label';
  sortLabel.textContent = 'Sort';
  const sortSelect = document.createElement('select');
  const activeSort = currentTaskSort[ws.id] || 'recent';
  [['recent', 'Recent'], ['priority', 'Priority'], ['due', 'Due date']].forEach(([val, text]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if (activeSort === val) opt.selected = true;
    sortSelect.appendChild(opt);
  });
  sortSelect.addEventListener('change', () => { currentTaskSort[ws.id] = sortSelect.value; render(); });
  sortRow.appendChild(sortLabel);
  sortRow.appendChild(sortSelect);
  container.appendChild(sortRow);

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
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks yet.';
    list.appendChild(empty);
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

  const metaBits = [];
  const dueLabel = formatDueLabel(t);
  if (dueLabel) metaBits.push(`Due ${dueLabel}`);
  if (isRecurring) {
    const streak = taskStreak(t);
    metaBits.push((t.recurrence === 'daily' ? 'Daily' : 'Weekly') + (streak > 0 ? ` · 🔥${streak}` : ''));
  }
  if (metaBits.length) {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = metaBits.join(' · ');
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
  delBtn.className = 'icon-btn small';
  delBtn.textContent = '✕';
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
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', () => { currentTimetableDate = addDaysStr(currentTimetableDate, -1); render(); });

  const dateLabel = document.createElement('div');
  dateLabel.className = 'date-label';
  dateLabel.innerHTML = `<div class="date-main">${escapeHtml(formatDateLabel(currentTimetableDate))}</div><div class="date-sub">${currentTimetableDate}</div>`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'icon-btn';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', () => { currentTimetableDate = addDaysStr(currentTimetableDate, 1); render(); });

  switcher.appendChild(prevBtn);
  switcher.appendChild(dateLabel);
  switcher.appendChild(nextBtn);
  container.appendChild(switcher);

  const actions = document.createElement('div');
  actions.className = 'action-row';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-secondary';
  addBtn.textContent = '+ Add block';
  addBtn.addEventListener('click', () => openBlockModal(null));

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn-outline';
  loadBtn.textContent = 'Load template';
  loadBtn.addEventListener('click', () => loadTemplateIntoDay(currentTimetableDate));

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-outline';
  saveBtn.textContent = 'Save as template';
  saveBtn.addEventListener('click', () => saveDayAsTemplate(currentTimetableDate));

  actions.appendChild(addBtn);
  actions.appendChild(loadBtn);
  actions.appendChild(saveBtn);
  container.appendChild(actions);

  const list = document.createElement('div');
  list.className = 'block-list';
  const blocks = Store.state.blocks
    .filter((b) => b.date === currentTimetableDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (blocks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nothing planned. Tap "Add block" to start, or load your template.';
    list.appendChild(empty);
  } else {
    blocks.forEach((b) => list.appendChild(renderBlockCard(b)));
  }
  container.appendChild(list);

  return container;
}

function renderBlockCard(b) {
  const card = document.createElement('div');
  card.className = 'block-card';

  const header = document.createElement('div');
  header.className = 'block-header';

  const time = document.createElement('div');
  time.className = 'block-time';
  time.textContent = `${b.start} – ${b.end}`;
  header.appendChild(time);

  const titleRow = document.createElement('div');
  titleRow.className = 'block-title-row';
  const titleEl = document.createElement('div');
  titleEl.className = 'block-title';
  titleEl.textContent = b.title;
  titleRow.appendChild(titleEl);
  const linkedTask = b.taskId ? Store.state.tasks.find((t) => t.id === b.taskId) : null;
  if (linkedTask) {
    const badge = document.createElement('div');
    badge.className = 'linked-badge';
    badge.textContent = `from: ${linkedTask.title}`;
    titleRow.appendChild(badge);
  }
  header.appendChild(titleRow);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'block-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn small';
  editBtn.textContent = '✎';
  editBtn.addEventListener('click', () => openBlockModal(b));
  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn small';
  delBtn.textContent = '✕';
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
    del.textContent = '✕';
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
  subInput.placeholder = 'Add a subtask for this block...';
  const subBtn = document.createElement('button');
  subBtn.type = 'submit';
  subBtn.className = 'btn-mini';
  subBtn.textContent = '+';
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

function buildProgressRow(label, valueText, pct) {
  const row = document.createElement('div');
  row.className = 'progress-row';
  const top = document.createElement('div');
  top.className = 'progress-row-top';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
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
      `${ws.icon || '📁'} ${ws.name}`,
      wsTasks.length ? `${wsDone}/${wsTasks.length}` : 'No tasks',
      pct,
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
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No recurring tasks yet — set a task to repeat Daily or Weekly to build a streak.';
    streakSection.appendChild(p);
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
      right.textContent = streak > 0 ? `🔥 ${streak}` : '—';
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
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'Start typing to search across every workspace.';
      results.appendChild(p);
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
    status.textContent = `Signed in as ${currentUser.email}. Synced across every device signed into this account.`;
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
      delBtn.className = 'icon-btn small';
      delBtn.textContent = '✕';
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
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.workspaces) || !Array.isArray(data.tasks)) throw new Error('bad format');
      if (!confirm('Replace all current data with this backup?')) return;
      Store.state = data;
      Store.migrate();
      Store.save();
      closeModal();
      render();
    } catch (e) {
      alert('Could not read that file — is it a Personal OS backup JSON?');
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
  } else {
    el.style.display = 'flex';
    el.textContent = "Tomorrow's timetable isn't planned yet — open the Timetable workspace.";
  }
}

/* ============================== Root render ============================== */

function render() {
  renderNudgeBanner();
  renderWorkspaceNav();
  const ws = getWorkspace(currentWorkspaceId);
  const content = document.getElementById('content');
  content.innerHTML = '';
  if (!ws) {
    currentWorkspaceId = Store.state.workspaces[0].id;
    render();
    return;
  }
  if (ws.type === 'timetable') content.appendChild(renderTimetableView());
  else if (ws.type === 'stats') content.appendChild(renderStatsView());
  else content.appendChild(renderTaskWorkspaceView(ws));
}

/* ============================== Init ============================== */

document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  applyTheme();
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('searchBtn').addEventListener('click', openSearchModal);
  render();
  startReminderLoop();
  initSync();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
