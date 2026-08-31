import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addBlock, deleteBlock, isTaskDoneToday, updateBlock, useStore } from '@/lib/store';
import { formatDuration, formatTime12, minutesOf } from '@/lib/date';
import type { Block } from '@/lib/types';

const NONE = '__none__';

export function BlockDialog({ date, block, onClose }: {
  date: string; block: Block | null; onClose: () => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const workspaces = useStore((s) => s.workspaces);
  const [title, setTitle] = useState(block?.title ?? '');
  const [start, setStart] = useState(block?.start ?? '09:00');
  const [end, setEnd] = useState(block?.end ?? '10:00');
  const [taskId, setTaskId] = useState(block?.taskId ?? NONE);
  const [error, setError] = useState('');

  const candidates = useMemo(() => tasks.filter((t) => {
    if (isTaskDoneToday(t)) return false;
    if (t.labels.some((l) => l === 'Today' || l === 'Tomorrow' || l === 'Important')) return true;
    return t.dueDate === date;
  }), [tasks, date]);

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
    const linked = taskId === NONE ? null : taskId;
    if (block) updateBlock(block.id, { title: name, start, end, taskId: linked });
    else addBlock(date, name, start, end, linked);
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

          {candidates.length > 0 && (
            <div className="space-y-2">
              <Label>Or pick a task</Label>
              <Select value={taskId} onValueChange={(v) => {
                setTaskId(v);
                const t = tasks.find((x) => x.id === v);
                if (t) setTitle(t.title);
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="— none —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  {candidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {workspaces.find((w) => w.id === t.workspaceId)?.name}: {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
