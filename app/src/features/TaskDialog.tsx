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
import { PriorityPicker } from '@/components/PriorityPicker';
import { deleteTask, normalizeLink, updateTask, useStore, type PriorityId } from '@/lib/store';
import type { Recurrence, Task } from '@/lib/types';

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const allLabels = useStore((s) => s.labels);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [labels, setLabels] = useState<string[]>(task.labels);
  const [priority, setPriority] = useState<PriorityId | null>(task.priority);
  const [link, setLink] = useState(task.link ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);

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
