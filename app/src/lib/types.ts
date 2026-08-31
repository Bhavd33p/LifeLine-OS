export type WorkspaceType = 'timetable' | 'tasks' | 'stats' | 'meals';
export type Priority = 'p1' | 'p2' | 'p3' | 'p4' | null;
export type Recurrence = 'none' | 'daily' | 'weekly';
export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  system?: boolean;
  type: WorkspaceType;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  notes: string;
  labels: string[];
  done: boolean;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  /** Optional URL — the application form, the posting, the doc. */
  link: string | null;
  recurrence: Recurrence;
  completions: Record<string, boolean>;
  createdAt: number;
  completedAt: number | null;
}

export interface Subtask { id: string; title: string; done: boolean }

/** null means the block was never marked either way, which is not the same as missed. */
export type BlockStatus = 'done' | 'missed' | null;

export interface Block {
  id: string;
  date: string;
  title: string;
  start: string;
  end: string;
  /** Tasks pulled into this block, from any workspace. */
  taskIds: string[];
  /** Notify at this block's start time. Off unless asked for. */
  reminder: boolean;
  status: BlockStatus;
  subtasks: Subtask[];
}

/** A template is a plan, so it carries no date, no link and no done/missed mark. */
export type TemplateBlock = Omit<Block, 'date' | 'taskIds' | 'status'>;

export interface Alarm {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
  checkPlanning?: boolean;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  alarms: Alarm[];
}

export type MealDay = Partial<Record<MealSlot, string>>;

export interface AppState {
  version: number;
  workspaces: Workspace[];
  tasks: Task[];
  blocks: Block[];
  template: TemplateBlock[];
  labels: string[];
  meals: Record<string, MealDay>;
  settings: Settings;
}
