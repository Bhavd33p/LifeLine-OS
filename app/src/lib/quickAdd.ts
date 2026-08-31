/**
 * What the add bar asks for, per workspace. A generic "Add to X..." field makes
 * every category feel the same when they are not: a post needs a platform and
 * an idea, an application needs a link and a deadline, a problem needs its URL.
 *
 * Chips are applied as ordinary labels, so they filter and sort like any other
 * and are not a second tagging system.
 */
export interface QuickAddConfig {
  placeholder: string;
  /** One-tap labels offered in this workspace, e.g. platforms. */
  chips?: { label: string; options: string[] };
  note?: string;
  link?: string;
  due?: string;
}

const DEFAULTS: Record<string, QuickAddConfig> = {
  content: {
    placeholder: 'Post idea, hook or topic...',
    chips: { label: 'Platform', options: ['Instagram', 'X', 'LinkedIn', 'YouTube', 'Blog'] },
    note: 'The idea — angle, hook, what it says',
    link: 'Reference or draft link',
    due: 'Publish on',
  },
  openings: {
    placeholder: 'Company and role...',
    chips: { label: 'Stage', options: ['Applied', 'OA', 'Interview', 'Referral'] },
    note: 'Notes — recruiter, referral, comp',
    link: 'Application link',
    due: 'Closes on',
  },
  cpdsa: {
    placeholder: 'Problem or topic...',
    chips: { label: 'Topic', options: ['DP', 'Graphs', 'Trees', 'Greedy', 'Binary search'] },
    link: 'Problem link',
    due: 'Solve by',
  },
  gym: {
    placeholder: 'Workout or lift...',
    chips: { label: 'Focus', options: ['Push', 'Pull', 'Legs', 'Cardio', 'Rest'] },
  },
  health: {
    placeholder: 'Habit or check-up...',
    due: 'Due on',
  },
  skincare: {
    placeholder: 'Step or product...',
    chips: { label: 'When', options: ['Morning', 'Night', 'Weekly'] },
  },
  tasks: {
    placeholder: 'What needs doing...',
    note: 'Any detail worth keeping',
    link: 'Link (optional)',
    due: 'Due date',
  },
};

const GENERIC: QuickAddConfig = {
  placeholder: 'Add a task...',
  link: 'Link (optional)',
  due: 'Due date',
};

export function quickAddConfig(workspaceId: string, workspaceName: string): QuickAddConfig {
  const found = DEFAULTS[workspaceId];
  if (found) return found;
  // Custom workspaces keep the old wording, which named the workspace.
  return { ...GENERIC, placeholder: `Add to ${workspaceName}...` };
}
