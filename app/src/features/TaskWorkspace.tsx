import { useMemo, useRef, useState } from 'react';
import { Check, Flame, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { addTask, deleteTask, isTaskDoneToday, streakOf, toggleTaskDone, useStore } from '@/lib/store';
import { formatDateLabel } from '@/lib/date';
import type { Task, Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortMode = 'recent' | 'priority' | 'due';
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function TaskWorkspace({ ws }: { ws: Workspace }) {
  const tasks = useStore((s) => s.tasks);
  const labels = useStore((s) => s.labels);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');

  const mine = useMemo(() => tasks.filter((t) => t.workspaceId === ws.id), [tasks, ws.id]);
  const shown = useMemo(() => {
    const list = filter ? mine.filter((t) => t.labels.includes(filter)) : mine.slice();
    list.sort((a, b) => {
      const doneDiff = Number(isTaskDoneToday(a)) - Number(isTaskDoneToday(b));
      if (doneDiff) return doneDiff;
      if (sort === 'priority') {
        return (PRIORITY_RANK[a.priority ?? ''] ?? 3) - (PRIORITY_RANK[b.priority ?? ''] ?? 3);
      }
      if (sort === 'due') {
        if (!a.dueDate) return b.dueDate ? 1 : 0;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return b.createdAt - a.createdAt;
    });
    return list;
  }, [mine, filter, sort]);

  return (
    <div className="space-y-4">
      <QuickAdd ws={ws} labels={labels} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={!filter} onClick={() => setFilter(null)}>All</FilterChip>
        {labels.map((l) => (
          <FilterChip key={l} active={filter === l} onClick={() => setFilter(l)}>{l}</FilterChip>
        ))}
        <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
          <SelectTrigger size="sm" className="ml-auto w-32" aria-label="Sort tasks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="due">Due date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={filter ? `Nothing labelled ${filter}` : `No tasks in ${ws.name} yet`}
          body={filter ? undefined : 'Add one above — it stays on this device unless you turn on sync.'}
        />
      ) : (
        <div className="space-y-2">
          {shown.map((t) => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <Button variant={active ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs"
      onClick={onClick}>{children}</Button>
  );
}

/**
 * Stays open and focused after each add, keeping the chosen labels, so a run of
 * tasks goes in one after another rather than costing a tap each.
 */
function QuickAdd({ ws, labels }: { ws: Workspace; labels: string[] }) {
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (l: string) =>
    setPicked((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));

  return (
    <Card className="gap-3 p-3">
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        const name = title.trim();
        if (!name) return;
        addTask(ws.id, name, picked);
        setTitle('');
        setJustAdded(name);
        inputRef.current?.focus();
      }}>
        <Input ref={inputRef} value={title} placeholder={`Add to ${ws.name}...`}
          onChange={(e) => setTitle(e.target.value)} onFocus={() => setOpen(true)} />
        <Button type="submit" size="icon" aria-label="Add task"><Plus /></Button>
      </form>

      {open && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <Badge key={l} variant={picked.includes(l) ? 'default' : 'outline'}
              className="cursor-pointer select-none" onClick={() => toggle(l)}>
              {l}
            </Badge>
          ))}
        </div>
      )}

      {justAdded && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="size-3.5" /> Added “{justAdded}”
        </p>
      )}
    </Card>
  );
}

function TaskRow({ task: t }: { task: Task }) {
  const done = isTaskDoneToday(t);
  const streak = streakOf(t);
  return (
    <Card className={cn('flex-row items-center gap-3 p-3', done && 'opacity-60')}>
      <Checkbox checked={done} onCheckedChange={() => toggleTaskDone(t.id)} aria-label={t.title} />
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-medium break-words', done && 'line-through')}>{t.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {t.labels.map((l) => (
            <Badge key={l} variant="secondary" className="px-1.5 py-0 text-[10px]">{l}</Badge>
          ))}
          {t.priority && (
            <Badge variant={t.priority === 'high' ? 'destructive' : 'outline'}
              className="px-1.5 py-0 text-[10px] capitalize">{t.priority}</Badge>
          )}
          {t.dueDate && (
            <span className="text-[11px] text-muted-foreground">{formatDateLabel(t.dueDate)}</span>
          )}
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
              <Flame className="size-3" />{streak}
            </span>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Delete task"
        onClick={() => { if (confirm(`Delete “${t.title}”?`)) deleteTask(t.id); }}>
        <Trash2 className="size-4" />
      </Button>
    </Card>
  );
}
