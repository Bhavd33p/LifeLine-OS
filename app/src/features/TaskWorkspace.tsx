import { useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Flame, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { PriorityPicker } from '@/components/PriorityPicker';
import { TaskDialog } from './TaskDialog';
import { Contests } from './Contests';
import {
  PRIORITY_RANK, type PriorityId, addTask, isTaskDoneToday,
  priorityOf, streakOf, toggleTaskDone, useStore,
} from '@/lib/store';
import { formatDateLabel, todayStr } from '@/lib/date';
import type { Task, Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortMode = 'recent' | 'priority' | 'due';

export function TaskWorkspace({ ws }: { ws: Workspace }) {
  const tasks = useStore((s) => s.tasks);
  const labels = useStore((s) => s.labels);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');
  const [editing, setEditing] = useState<Task | null>(null);

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
      {ws.id === 'cpdsa' && <Contests />}
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

      {editing && <TaskDialog task={editing} onClose={() => setEditing(null)} />}

      {shown.length === 0 ? (
        <EmptyState
          title={filter ? `Nothing labelled ${filter}` : `No tasks in ${ws.name} yet`}
          body={filter ? undefined : 'Add one above — it stays on this device unless you turn on sync.'}
        />
      ) : (
        <div className="space-y-2">
          {shown.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} />)}
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
  const [link, setLink] = useState('');
  const [dueDate, setDueDate] = useState('');
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
        addTask(ws.id, name, picked, { priority, link: link || null, dueDate: dueDate || null });
        setTitle('');
        // The link belongs to one application; the labels, priority and
        // deadline usually carry across a run of them.
        setLink('');
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

          <PriorityPicker value={priority} onChange={setPriority} />

          <div className="grid grid-cols-2 gap-2">
            <Input value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="Link (optional)" aria-label="Link" type="url" className="h-8 text-sm" />
            <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date" type="date" className="h-8 text-sm" />
          </div>
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

function TaskRow({ task: t, onEdit }: { task: Task; onEdit: () => void }) {
  const done = isTaskDoneToday(t);
  const streak = streakOf(t);
  const prio = priorityOf(t.priority);
  return (
    <Card className={cn('flex-row items-center gap-3 p-3', done && 'opacity-60')}>
      <Checkbox checked={done} onCheckedChange={() => toggleTaskDone(t.id)} aria-label={t.title} />
      <button type="button" onClick={onEdit}
        className="min-w-0 flex-1 rounded text-left" aria-label={`Edit ${t.title}`}>
        <div className={cn('text-sm font-medium break-words', done && 'line-through')}>{t.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {t.labels.map((l) => (
            <Badge key={l} variant="secondary" className="px-1.5 py-0 text-[10px]">{l}</Badge>
          ))}
          {prio && (
            <Badge className={cn('px-1.5 py-0 text-[10px]', prio.className)}
              title={prio.definition}>
              {prio.label}
            </Badge>
          )}
          {t.dueDate && (
            <span className={cn('text-[11px]',
              // A deadline already past is the thing you most need to notice.
              t.dueDate < todayStr() && !done ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              {formatDateLabel(t.dueDate)}
            </span>
          )}
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
              <Flame className="size-3" />{streak}
            </span>
          )}
        </div>
      </button>
      {t.link && (
        <a href={t.link} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open the link for ${t.title}`}
          title={t.link}
          className="shrink-0 rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ExternalLink className="size-4" />
        </a>
      )}
    </Card>
  );
}
