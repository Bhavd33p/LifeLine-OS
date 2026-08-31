import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Workflow } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DEFAULT_ESTIMATE_MINUTES, addBlock, isTaskDoneToday, useStore,
} from '@/lib/store';
import { buildSchedule } from '@/lib/schedule';
import { formatDateLabel, formatDuration, formatTime12, nowTimeStr } from '@/lib/date';
import { cn } from '@/lib/utils';

/**
 * Turns a dependency graph into a day. Tasks are ordered so prerequisites come
 * first, then laid end to end from a start time around whatever is already
 * booked. The result is previewed before anything is written.
 */
export function BuildDayDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const workspaces = useStore((s) => s.workspaces);
  const blocks = useStore((s) => s.blocks);

  const candidates = useMemo(
    () => tasks.filter((t) => !isTaskDoneToday(t)),
    [tasks],
  );
  // Pre-tick what plainly belongs in a day: anything estimated, anything with
  // dependencies to honour, and anything due on or before the day being built.
  const [selected, setSelected] = useState<string[]>(() => candidates
    .filter((t) => t.estimateMinutes || t.dependsOn.length || (t.dueDate && t.dueDate <= date))
    .map((t) => t.id));
  const [startTime, setStartTime] = useState(nowTimeStr);

  const busy = useMemo(() => blocks.filter((b) => b.date === date), [blocks, date]);

  const result = useMemo(() => buildSchedule(
    candidates
      .filter((t) => selected.includes(t.id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        estimate: t.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES,
        dependsOn: t.dependsOn,
      })),
    { startTime, busy },
  ), [candidates, selected, startTime, busy]);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[88svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="size-4" /> Build my day
          </DialogTitle>
          <DialogDescription>
            Orders the tasks you pick so prerequisites come first, then fills
            {' '}{formatDateLabel(date)} around what is already booked.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="build-start">Start from</Label>
            <Input id="build-start" type="time" value={startTime}
              onChange={(e) => setStartTime(e.target.value)} className="w-40" />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Include</Label>
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            </div>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing open to schedule.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-md border">
                {candidates.map((t) => {
                  const on = selected.includes(t.id);
                  const ws = workspaces.find((w) => w.id === t.workspaceId);
                  return (
                    <label key={t.id}
                      className={cn('flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm',
                        on ? 'bg-accent' : 'hover:bg-accent/50')}>
                      <Checkbox checked={on} onCheckedChange={() => toggle(t.id)} />
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {t.dependsOn.length > 0 && (
                        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                          {t.dependsOn.length} dep{t.dependsOn.length === 1 ? '' : 's'}
                        </Badge>
                      )}
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {formatDuration(t.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES)}
                      </span>
                      <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                        {ws?.name ?? '—'}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A task with no estimate is treated as {formatDuration(DEFAULT_ESTIMATE_MINUTES)}.
            </p>
          </div>

          {result.cycle ? (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" /> These depend on each other in a loop
              </p>
              <p className="text-xs text-destructive">{result.cycle.join(' → ')}</p>
              <p className="text-xs text-muted-foreground">
                Nothing can be ordered until one of those links is removed.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Preview</Label>
              {result.blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to place.</p>
              ) : (
                <div className="rounded-md border">
                  {result.blocks.map((b) => (
                    <div key={b.taskId} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                      <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
                        {formatTime12(b.start)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{b.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.skipped.length > 0 && (
                <div className="space-y-1 rounded-md bg-muted p-3">
                  <p className="text-xs font-medium">Left out</p>
                  {result.skipped.map((s) => (
                    <p key={s.id} className="text-xs text-muted-foreground">
                      {s.title} — {s.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button"
            disabled={!!result.cycle || result.blocks.length === 0}
            onClick={() => {
              result.blocks.forEach((b) => addBlock(date, b.title, b.start, b.end, [b.taskId], false));
              toast.success(`Added ${result.blocks.length} block${result.blocks.length === 1 ? '' : 's'}.`);
              onClose();
            }}>
            Add {result.blocks.length || ''} block{result.blocks.length === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
