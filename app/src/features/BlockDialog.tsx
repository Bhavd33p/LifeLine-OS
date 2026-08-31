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
  addBlock, deleteBlock, isTaskDoneToday, priorityOf, updateBlock, useStore,
} from '@/lib/store';
import { formatDuration, formatTime12, minutesOf } from '@/lib/date';
import type { Block } from '@/lib/types';
import { cn } from '@/lib/utils';

export function BlockDialog({ date, block, onClose }: {
  date: string; block: Block | null; onClose: () => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const workspaces = useStore((s) => s.workspaces);
  const [title, setTitle] = useState(block?.title ?? '');
  const [start, setStart] = useState(block?.start ?? '09:00');
  const [end, setEnd] = useState(block?.end ?? '10:00');
  const [taskIds, setTaskIds] = useState<string[]>(block?.taskIds ?? []);
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
    if (block) updateBlock(block.id, { title: name, start, end, taskIds });
    else addBlock(date, name, start, end, taskIds);
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
