'use strict';

/* ============================== Data model ============================== */

const STORAGE_KEY = 'personalOS.v1';
const LAST_WORKSPACE_KEY = 'personalOS.lastWorkspace';

const DEFAULT_LABELS = ['Important', 'Today', 'Tomorrow', 'Office', 'Personal'];

const DEFAULT_WORKSPACES = [
  { id: 'timetable', name: 'Timetable', icon: '🗓️', system: true, type: 'timetable' },
  { id: 'tasks', name: 'Tasks', icon: '✅', system: true, type: 'tasks' },
  { id: 'health', name: 'Health', icon: '❤️', system: true, type: 'tasks' },
  { id: 'cpdsa', name: 'CP / DSA', icon: '💻', system: true, type: 'tasks' },
  { id: 'skincare', name: 'Skincare', icon: '✨', system: true, type: 'tasks' },
  { id: 'gym', name: 'Gym', icon: '🏋️', system: true, type: 'tasks' },
];

function defaultState() {
  return {
    version: 1,
    workspaces: DEFAULT_WORKSPACES.map((w) => ({ ...w })),
    tasks: [], // {id, workspaceId, title, notes, labels:[], done, createdAt}
    blocks: [], // {id, date:'YYYY-MM-DD', title, start:'HH:MM', end:'HH:MM', taskId, subtasks:[{id,title,done}]}
    template: [], // block-shape without date
    labels: [...DEFAULT_LABELS],
    settings: { theme: 'system', reminderEnabled: false, reminderTime: '20:00' },
  };
}

const Store = {
  state: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.state = raw ? JSON.parse(raw) : defaultState();
      if (!this.state || !Array.isArray(this.state.workspaces)) this.state = defaultState();
      if (!Array.isArray(this.state.labels)) this.state.labels = [...DEFAULT_LABELS];
      if (!Array.isArray(this.state.template)) this.state.template = [];
      if (!this.state.settings) this.state.settings = defaultState().settings;
    } catch (e) {
      this.state = defaultState();
    }
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
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

/* ============================== Mutations ============================== */

function addTask(workspaceId, title, labels) {
  Store.state.tasks.push({ id: uid(), workspaceId, title, notes: '', labels, done: false, createdAt: Date.now() });
  Store.save();
}
function updateTask(id, patch) {
  const t = Store.state.tasks.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  Store.save();
}
function toggleTaskDone(id) {
  const t = Store.state.tasks.find((x) => x.id === id);
  if (t) t.done = !t.done;
  Store.save();
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

function setWorkspace(id) {
  currentWorkspaceId = id;
  localStorage.setItem(LAST_WORKSPACE_KEY, id);
  render();
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

/* ============================== Task workspace view ============================== */

function renderTaskWorkspaceView(ws) {
  const container = document.createElement('div');
  container.className = 'task-workspace';

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

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn-primary';
  submitBtn.textContent = 'Add task';
  form.appendChild(submitBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    addTask(ws.id, title, Array.from(selectedLabels));
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

  const list = document.createElement('div');
  list.className = 'task-list';
  const tasks = Store.state.tasks
    .filter((t) => t.workspaceId === ws.id)
    .filter((t) => !activeFilter || t.labels.includes(activeFilter))
    .sort((a, b) => (a.done === b.done ? b.createdAt - a.createdAt : (a.done ? 1 : -1)));

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

function renderTaskRow(t) {
  const row = document.createElement('div');
  row.className = 'task-row' + (t.done ? ' done' : '');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'task-check';
  check.checked = t.done;
  check.addEventListener('change', () => { toggleTaskDone(t.id); render(); });
  row.appendChild(check);

  const main = document.createElement('div');
  main.className = 'task-main';
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = t.title;
  main.appendChild(title);
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
    updateTask(t.id, { title, notes: notesInput.value.trim(), labels: Array.from(selected) });
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

  const candidateTasks = Store.state.tasks.filter(
    (t) => !t.done && (t.labels.includes('Today') || t.labels.includes('Important') || t.labels.includes('Tomorrow')),
  );
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

/* ============================== Settings ============================== */

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

  const reminder = document.createElement('div');
  reminder.className = 'settings-section';
  reminder.innerHTML = '<h3>Plan-tomorrow reminder</h3>';
  const switchRow = document.createElement('label');
  switchRow.className = 'switch-row';
  const enabledCheck = document.createElement('input');
  enabledCheck.type = 'checkbox';
  enabledCheck.checked = s.reminderEnabled;
  enabledCheck.addEventListener('change', (e) => {
    Store.state.settings.reminderEnabled = e.target.checked;
    Store.save();
    if (e.target.checked) requestNotificationPermission();
  });
  switchRow.appendChild(enabledCheck);
  switchRow.appendChild(document.createTextNode('Enabled'));
  reminder.appendChild(switchRow);

  const timeLabel = document.createElement('label');
  timeLabel.textContent = 'Time';
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.value = s.reminderTime;
  timeInput.addEventListener('change', (e) => {
    Store.state.settings.reminderTime = e.target.value;
    Store.save();
  });
  timeLabel.appendChild(timeInput);
  reminder.appendChild(timeLabel);

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
let lastReminderFiredDate = null;

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
  const s = Store.state.settings;
  if (!s.reminderEnabled) return;
  const now = new Date();
  const nowStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const today = todayStr();
  if (nowStr === s.reminderTime && lastReminderFiredDate !== today) {
    lastReminderFiredDate = today;
    const tomorrow = addDaysStr(today, 1);
    const planned = Store.state.blocks.some((b) => b.date === tomorrow);
    if (!planned && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Plan tomorrow', { body: "You haven't built tomorrow's timetable yet." });
    }
  }
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
  else content.appendChild(renderTaskWorkspaceView(ws));
}

/* ============================== Init ============================== */

document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  applyTheme();
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  render();
  startReminderLoop();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
