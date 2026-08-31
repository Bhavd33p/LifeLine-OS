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
  recurrence: Recurrence;
  completions: Record<string, boolean>;
  createdAt: number;
  completedAt: number | null;
}

export interface Subtask { id: string; title: string; done: boolean }

export interface Block {
  id: string;
  date: string;
  title: string;
  start: string;
  end: string;
  taskId: string | null;
  subtasks: Subtask[];
}

export type TemplateBlock = Omit<Block, 'date' | 'taskId'>;

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
