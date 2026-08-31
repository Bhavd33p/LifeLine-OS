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
  /** An optional count, labelled for the category it belongs to. */
  quantity?: { placeholder: string; unit: string };
}

const DEFAULTS: Record<string, QuickAddConfig> = {
  content: {
    placeholder: 'Post title or topic...',
    chips: { label: 'Platform', options: ['Instagram', 'X', 'LinkedIn', 'YouTube', 'Blog'] },
    quantity: { placeholder: 'How many posts', unit: 'posts' },
    note: 'The idea — angle, hook, what it says',
    link: 'Source (src) link',
    due: 'Publish on',
  },
  openings: {
    placeholder: 'Company name...',
    chips: { label: 'Stage', options: ['Applied', 'OA', 'Interview', 'Referral'] },
    // Held as a number so applications can be sorted and compared by it rather
    // than being a string like "24 LPA" that only reads well.
    quantity: { placeholder: 'CTC offered (LPA)', unit: 'LPA' },
    note: 'Role, recruiter, referral',
    link: 'Application link',
    due: 'Closes on',
  },
  cpdsa: {
    placeholder: 'Lecture or problem...',
    chips: { label: 'Type', options: ['Lecture', 'Practice'] },
    link: 'Problem link',
    due: 'Due by',
  },
  gym: {
    placeholder: 'Session name...',
    chips: { label: 'Type', options: ['HRX workout', 'Gym', 'Dance', 'Yoga', 'Cardio'] },
    quantity: { placeholder: 'Minutes', unit: 'min' },
    due: 'On',
  },
  health: {
    placeholder: 'Habit or check-up...',
    due: 'Due on',
  },
  skincare: {
    placeholder: 'Step or product...',
    chips: { label: 'When', options: ['Morning', 'Afternoon', 'Night'] },
    note: 'Product or note',
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
