import {
  Calendar, CheckSquare, Heart, Code2, Sparkles, Dumbbell,
  UtensilsCrossed, BarChart3, Briefcase, Folder, type LucideIcon,
} from 'lucide-react';

/** Built-in workspaces get a real icon; custom ones fall back to a folder. */
const BY_ID: Record<string, LucideIcon> = {
  timetable: Calendar,
  tasks: CheckSquare,
  health: Heart,
  cpdsa: Code2,
  skincare: Sparkles,
  gym: Dumbbell,
  openings: Briefcase,
  meals: UtensilsCrossed,
  stats: BarChart3,
};

export const workspaceIcon = (id: string): LucideIcon => BY_ID[id] ?? Folder;
