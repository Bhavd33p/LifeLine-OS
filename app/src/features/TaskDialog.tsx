import { useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PriorityPicker } from '@/components/PriorityPicker';
import { deleteTask, normalizeLink, updateTask, useStore, type PriorityId } from '@/lib/store';
import type { Recurrence, Task } from '@/lib/types';

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const allLabels = useStore((s) => s.labels);
  const allTasks = useStore((s) => s.tasks);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [labels, setLabels] = useState<string[]>(task.labels);
  const [priority, setPriority] = useState<PriorityId | null>(task.priority);
  const [link, setLink] = useState(task.link ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);
  const [estimate, setEstimate] = useState(task.estimateMinutes ? String(task.estimateMinutes) : '');
  const [dependsOn, setDependsOn] = useState<string[]>(task.dependsOn);
  const [depQuery, setDepQuery] = useState('');

  const toggle = (l: string) =>
    setLabels((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>

        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const name = title.trim();
          if (!name) return;
          updateTask(task.id, {
            title: name, notes, labels, priority,
            link: normalizeLink(link),
            dependsOn,
            estimateMinutes: Number(estimate) > 0 ? Number(estimate) : null,
            dueDate: dueDate || null,
            // A time with no date has nothing to hang off, so it is dropped.
            dueTime: dueDate ? (dueTime || null) : null,
            recurrence,
          });
          onClose();
        }}>
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} required onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Input id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-link">Link</Label>
            <Input id="task-link" type="url" value={link} placeholder="careers.example.com/apply"
              onChange={(e) => setLink(e.target.value)} />
            {link.trim() && !normalizeLink(link) && (
              <p className="text-xs text-destructive">
                That doesn't look like a web address, so it won't be saved as a link.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            <div className="flex flex-wrap gap-1.5">
              {allLabels.map((l) => (
                <Badge key={l} variant={labels.includes(l) ? 'default' : 'outline'}
                  className="cursor-pointer select-none" onClick={() => toggle(l)}>{l}</Badge>
              ))}
            </div>
          </div>

          <PriorityPicker value={priority} onChange={setPriority} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input id="task-due" type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due-time">Due time</Label>
              <Input id="task-due-time" type="time" value={dueTime} disabled={!dueDate}
                onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Repeat</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            {recurrence !== 'none' && (
              <p className="text-xs text-muted-foreground">
                A repeating task is ticked off per day and builds a streak.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-estimate">Estimate (minutes)</Label>
            <Input id="task-estimate" type="number" min={5} step={5} value={estimate}
              placeholder="30" className="w-32"
              onChange={(e) => setEstimate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              How long it takes. Used when building a day from dependencies.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Depends on</Label>
              <span className="text-xs text-muted-foreground">
                {dependsOn.length ? `${dependsOn.length} selected` : 'optional'}
              </span>
            </div>
            <Input value={depQuery} onChange={(e) => setDepQuery(e.target.value)}
              placeholder="Filter tasks..." className="h-9" />
            {/* Self is excluded; a task depending on itself can never start. */}
            {(() => {
              const q = depQuery.trim().toLowerCase();
              const options = allTasks.filter((o) => o.id !== task.id
                && (!q || o.title.toLowerCase().includes(q)));
              if (options.length === 0) {
                return <p className="py-1 text-sm text-muted-foreground">No other tasks.</p>;
              }
              return (
                <div className="max-h-36 overflow-y-auto rounded-md border">
                  {options.map((o) => {
                    const on = dependsOn.includes(o.id);
                    return (
                      <label key={o.id}
                        className={cn('flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm',
                          on ? 'bg-accent' : 'hover:bg-accent/50')}>
                        <Checkbox checked={on} onCheckedChange={() => setDependsOn((p) =>
                          p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id])} />
                        <span className="min-w-0 flex-1 truncate">{o.title}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground">
              These must be finished first. A loop is reported when you build a day.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="destructive" onClick={() => {
              if (confirm(`Delete “${task.title}”?`)) { deleteTask(task.id); onClose(); }
            }}>Delete</Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
