import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  addBlock, addRepeatingBlocks, deleteBlock, isTaskDoneToday, priorityOf, updateBlock,
  useStore, weekdayOf,
} from '@/lib/store';
import { formatDateLabel, formatDuration, formatTime12, minutesOf } from '@/lib/date';
import { toast } from 'sonner';
import type { Block } from '@/lib/types';
import { cn } from '@/lib/utils';

type RepeatMode = 'none' | 'daily' | 'weekdays' | 'weekends' | 'custom';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKENDS = [5, 6];

export function BlockDialog({ date, block, onClose }: {
  date: string; block: Block | null; onClose: () => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const workspaces = useStore((s) => s.workspaces);
  const [title, setTitle] = useState(block?.title ?? '');
  const [start, setStart] = useState(block?.start ?? '09:00');
  const [end, setEnd] = useState(block?.end ?? '10:00');
  const [taskIds, setTaskIds] = useState<string[]>(block?.taskIds ?? []);
  const [reminder, setReminder] = useState(block?.reminder ?? false);
  // Repeat only applies when creating: editing one day of an existing run and
  // silently rewriting the others would be a surprise, not a convenience.
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [customDays, setCustomDays] = useState<number[]>([weekdayOf(date)]);
  const [weeks, setWeeks] = useState(4);
  const [taskQuery, setTaskQuery] = useState('');
  const [error, setError] = useState('');

  // Every open task, grouped by workspace, so a block can pull work from
  // CP/DSA and Health at once rather than being limited to a single task.
  const groups = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    return workspaces
      .filter((w) => w.type === 'tasks')
      .map((w) => ({
        workspace: w,
        tasks: tasks.filter((t) => t.workspaceId === w.id
          && (!isTaskDoneToday(t) || taskIds.includes(t.id))
          && (!q || t.title.toLowerCase().includes(q))),
      }))
      .filter((g) => g.tasks.length > 0);
  }, [workspaces, tasks, taskQuery, taskIds]);

  const toggleTask = (id: string) =>
    setTaskIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const days = repeat === 'daily' ? ALL_DAYS
    : repeat === 'weekdays' ? WEEKDAYS
    : repeat === 'weekends' ? WEEKENDS
    : repeat === 'custom' ? customDays
    : [];

  const sMin = minutesOf(start);
  const eMin = minutesOf(end);
  // An end before the start is not an error — it means the block runs past
  // midnight. Say so plainly while they type.
  const crossesMidnight = Number.isFinite(sMin) && Number.isFinite(eMin) && eMin < sMin;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name || !start || !end) return;
    if (start === end) { setError('Start and end time cannot be the same.'); return; }
    if (repeat !== 'none' && days.length === 0) {
      setError('Pick at least one day to repeat on.');
      return;
    }
    if (block) {
      updateBlock(block.id, { title: name, start, end, taskIds, reminder });
    } else if (repeat === 'none') {
      addBlock(date, name, start, end, taskIds, reminder);
    } else {
      const created = addRepeatingBlocks(date, name, start, end, taskIds, reminder, days, weeks);
      toast.success(created === 1
        ? 'Added 1 block.'
        : `Added ${created} blocks over ${weeks} week${weeks === 1 ? '' : 's'}.`);
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{block ? 'Edit block' : 'New block'}</DialogTitle>
          <DialogDescription>A block can run past midnight into the next day.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-title">Title</Label>
            <Input id="block-title" value={title} autoFocus required
              onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Tasks in this block</Label>
              <span className="text-xs text-muted-foreground">
                {taskIds.length ? `${taskIds.length} selected` : 'optional'}
              </span>
            </div>
            <Input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)}
              placeholder="Filter tasks..." className="h-8" />

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {taskQuery ? `Nothing matches “${taskQuery}”.` : 'No open tasks to pull in yet.'}
              </p>
            ) : (
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border p-2">
                {groups.map(({ workspace, tasks: list }) => (
                  <div key={workspace.id} className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {workspace.name}
                    </p>
                    {list.map((t) => {
                      const prio = priorityOf(t.priority);
                      const on = taskIds.includes(t.id);
                      return (
                        <label key={t.id}
                          className={cn('flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm',
                            on ? 'bg-accent' : 'hover:bg-accent/50')}>
                          <Checkbox checked={on} onCheckedChange={() => toggleTask(t.id)} />
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          {prio && (
                            <Badge className={cn('shrink-0 px-1.5 py-0 text-[10px]', prio.className)}>
                              {prio.label}
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="block-start">Start</Label>
              <Input id="block-start" type="time" required value={start}
                onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-end">End</Label>
              <Input id="block-end" type="time" required value={end}
                onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {crossesMidnight && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
              Runs past midnight — ends {formatTime12(end)} the next day
              {' · '}{formatDuration(eMin + 1440 - sMin)}
            </p>
          )}
          {!block && (
            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatMode)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Just this day</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
                  <SelectItem value="weekends">Weekends</SelectItem>
                  <SelectItem value="custom">Chosen days</SelectItem>
                </SelectContent>
              </Select>

              {repeat === 'custom' && (
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, i) => {
                    const on = customDays.includes(i);
                    return (
                      <button key={i} type="button" aria-pressed={on}
                        aria-label={FULL_WEEKDAYS[i]}
                        onClick={() => setCustomDays((p) =>
                          p.includes(i) ? p.filter((x) => x !== i) : [...p, i])}
                        className={cn(
                          'size-9 rounded-full border text-xs font-semibold transition-colors',
                          on ? 'border-primary bg-primary text-primary-foreground'
                             : 'border-border text-muted-foreground hover:bg-accent',
                        )}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {repeat !== 'none' && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="repeat-weeks" className="shrink-0">for</Label>
                  <Input id="repeat-weeks" type="number" min={1} max={26} value={weeks}
                    onChange={(e) => setWeeks(Math.min(26, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-8 w-20" />
                  <span className="text-sm text-muted-foreground">
                    week{weeks === 1 ? '' : 's'} from {formatDateLabel(date)}
                  </span>
                </div>
              )}

              {repeat !== 'none' && (
                <p className="text-xs text-muted-foreground">
                  {days.length === 0
                    ? 'Pick at least one day.'
                    : `Creates up to ${days.length * weeks} blocks. Days that already have `
                      + `“${title.trim() || 'this block'}” at ${formatTime12(start)} are skipped.`}
                </p>
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <Checkbox checked={reminder} onCheckedChange={(v) => setReminder(v === true)}
              className="mt-0.5" />
            <span className="text-sm">
              Remind me at {formatTime12(start)}
              <span className="block text-xs text-muted-foreground">
                A notification when this block starts. It only fires while the app is
                open, and needs notification permission from Settings.
              </span>
            </span>
          </label>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:justify-between">
            {block ? (
              <Button type="button" variant="destructive" onClick={() => {
                if (confirm('Delete this block?')) { deleteBlock(block.id); onClose(); }
              }}>Delete</Button>
            ) : <span />}
            <Button type="submit">{block ? 'Save changes' : 'Add block'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
