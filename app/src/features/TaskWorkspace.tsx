import { useMemo, useRef, useState } from 'react';
import { Check, Flame, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmptyState } from '@/components/EmptyState';
import {
  PRIORITIES, PRIORITY_RANK, type PriorityId, addTask, deleteTask, isTaskDoneToday,
  priorityOf, streakOf, toggleTaskDone, useStore,
} from '@/lib/store';
import { formatDateLabel } from '@/lib/date';
import type { Task, Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortMode = 'recent' | 'priority' | 'due';

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
        return (PRIORITY_RANK[a.priority ?? ''] ?? 9) - (PRIORITY_RANK[b.priority ?? ''] ?? 9);
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
  const [priority, setPriority] = useState<PriorityId | null>(null);
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (l: string) =>
    setPicked((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  const chosen = priorityOf(priority);

  return (
    <Card className="gap-3 p-3">
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        const name = title.trim();
        if (!name) return;
        addTask(ws.id, name, picked, { priority });
        setTitle('');
        setJustAdded(name);
        // The labels and priority stay put, so a run of similar tasks goes in
        // without re-picking them each time.
        inputRef.current?.focus();
      }}>
        <Input ref={inputRef} value={title} placeholder={`Add to ${ws.name}...`}
          onChange={(e) => setTitle(e.target.value)} onFocus={() => setOpen(true)} />
        <Button type="submit" size="icon" aria-label="Add task"><Plus /></Button>
      </form>

      {open && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <Badge key={l} variant={picked.includes(l) ? 'default' : 'outline'}
                className="cursor-pointer select-none" onClick={() => toggle(l)}>
                {l}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Priority
            </span>
            {PRIORITIES.map((p) => {
              const active = priority === p.id;
              return (
                <button key={p.id} type="button"
                  aria-pressed={active}
                  title={`${p.label} — ${p.name}: ${p.definition}`}
                  onClick={() => setPriority(active ? null : p.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                    active ? p.className : 'border-border text-muted-foreground hover:bg-accent',
                  )}>
                  {p.label}
                </button>
              );
            })}

            {/* Definitions have to be reachable before you have picked one,
                and there is no hover on a phone. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-6"
                  aria-label="What do P1 to P4 mean?">
                  <HelpCircle className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <p className="mb-2 text-xs font-semibold">What the tiers mean</p>
                <ul className="space-y-2">
                  {PRIORITIES.map((p) => (
                    <li key={p.id} className="flex gap-2">
                      <span className={cn('mt-1 size-2 shrink-0 rounded-full', p.dot)} aria-hidden />
                      <span className="text-xs">
                        <b>{p.label} · {p.name}</b>
                        <span className="block text-muted-foreground">{p.definition}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          </div>

          {chosen && (
            <p className="text-xs text-muted-foreground">
              <b className="text-foreground">{chosen.label} · {chosen.name}</b> — {chosen.definition}
            </p>
          )}
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
  const prio = priorityOf(t.priority);
  return (
    <Card className={cn('flex-row items-center gap-3 p-3', done && 'opacity-60')}>
      <Checkbox checked={done} onCheckedChange={() => toggleTaskDone(t.id)} aria-label={t.title} />
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-medium break-words', done && 'line-through')}>{t.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {t.labels.map((l) => (
            <Badge key={l} variant="secondary" className="px-1.5 py-0 text-[10px]">{l}</Badge>
          ))}
          {prio && (
            <Badge className={cn('px-1.5 py-0 text-[10px]', prio.className)}
              title={`${prio.name}: ${prio.definition}`}>
              {prio.label}
            </Badge>
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
