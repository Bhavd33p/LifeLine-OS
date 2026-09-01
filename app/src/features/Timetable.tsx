import { useMemo, useState } from 'react';
import {
  Bell, BellOff, Check, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus,
  Trash2, Workflow, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { BlockDialog } from './BlockDialog';
import { BuildDayDialog } from './BuildDayDialog';
import { EmptyState } from '@/components/EmptyState';
import {
  addDaysStr, endMinutesOf, formatDateLabel, formatDuration, formatTime12,
  isOvernight, minutesOf, nowMinutes, todayStr,
} from '@/lib/date';
import {
  MEAL_SLOTS, addSubtask, deleteBlock, deleteSubtask, dishSuggestions, getState,
  isTaskDoneToday, loadTemplateIntoDay, priorityOf, saveDayAsTemplate, setBlockStatus,
  setMeal, toggleBlockReminder, toggleSubtask, toggleTaskDone, useStore,
} from '@/lib/store';
import { MealInput } from '@/components/MealInput';
import type { Block } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function Timetable({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const blocks = useStore((s) => s.blocks);
  const [editing, setEditing] = useState<Block | null | undefined>(undefined);
  const [building, setBuilding] = useState(false);

  const dayBlocks = useMemo(
    () => blocks.filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start)),
    [blocks, date],
  );
  const isToday = date === todayStr();
  // Yesterday's overnight blocks are still running this morning, so the Now
  // card needs them even though they sit on the previous day's timeline.
  const spill = useMemo(
    () => (isToday ? blocks.filter((b) => b.date === addDaysStr(date, -1) && isOvernight(b)) : []),
    [blocks, date, isToday],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous day"
          onClick={() => setDate(addDaysStr(date, -1))}>
          <ChevronLeft />
        </Button>
        <button type="button" onClick={() => setDate(todayStr())} title="Jump to today"
          className="flex-1 rounded-lg px-3 py-1.5 text-center transition-colors hover:bg-accent">
          <div className="text-base font-semibold tracking-tight">{formatDateLabel(date)}</div>
          <div className="text-xs tabular-nums text-muted-foreground">{date}</div>
        </button>
        <Button variant="outline" size="icon" aria-label="Next day"
          onClick={() => setDate(addDaysStr(date, 1))}>
          <ChevronRight />
        </Button>
      </div>

      {isToday && (dayBlocks.length > 0 || spill.length > 0) && (
        <NowCard blocks={dayBlocks} spill={spill} />
      )}

      <DueToday date={date} />
      <EatingToday date={date} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => {
          if (!getState().template.length) { toast.error('No saved template yet.'); return; }
          if (!confirm(`Replace ${formatDateLabel(date)}'s blocks with your template?`)) return;
          loadTemplateIntoDay(date);
          toast.success('Template loaded.');
        }}>Load template</Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (!dayBlocks.length) { toast.error('Nothing to save — this day has no blocks.'); return; }
          saveDayAsTemplate(date);
          toast.success('Saved as your daily template.');
        }}>Save as template</Button>
        <Button variant="outline" size="sm" onClick={() => setBuilding(true)}>
          <Workflow /> Build my day
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => setEditing(null)}>
          <Plus /> Add block
        </Button>
      </div>

      {dayBlocks.length === 0 ? (
        <EmptyState
          title="Nothing planned yet"
          body="Add a block, or load your saved template."
        />
      ) : (
        <Timeline blocks={dayBlocks} isToday={isToday} onEdit={setEditing} />
      )}

      {editing !== undefined && (
        <BlockDialog date={date} block={editing} onClose={() => setEditing(undefined)} />
      )}
      {building && <BuildDayDialog date={date} onClose={() => setBuilding(false)} />}
    </div>
  );
}

/** What's happening right now and what's next — the reason to open the app. */
function NowCard({ blocks, spill }: { blocks: Block[]; spill: Block[] }) {
  const now = nowMinutes();
  // Spill blocks are folded in at a negative offset — an 11pm start becomes
  // -60 — so one "now sits inside this range" test covers both days. Without
  // it an 11pm-7am sleep block reads "Free right now" at 6 in the morning.
  const occurrences = [
    ...spill.map((b) => ({ block: b, start: minutesOf(b.start) - 1440, end: endMinutesOf(b) - 1440 })),
    ...blocks.map((b) => ({ block: b, start: minutesOf(b.start), end: endMinutesOf(b) })),
  ].filter((o) => Number.isFinite(o.start) && Number.isFinite(o.end));

  const current = occurrences.find((o) => now >= o.start && now < o.end);
  const next = occurrences.find((o) => o.start > now);
  const doneSubs = current?.block.subtasks.filter((s) => s.done).length ?? 0;
  const linkedCount = current?.block.taskIds.length ?? 0;

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span className={cn('size-2 rounded-full', current ? 'animate-pulse bg-success' : 'bg-muted-foreground/50')} />
        {current ? 'Now' : 'Free right now'}
      </div>

      {current ? (
        <>
          <div className="text-xl font-semibold tracking-tight">{current.block.title}</div>
          <div className="text-sm text-muted-foreground">
            {formatTime12(current.block.start)} – {formatTime12(current.block.end)}
            {isOvernight(current.block) && <span className="ml-1 font-medium text-foreground">+1</span>}
            {' · '}{formatDuration(current.end - now)} left
          </div>
          <Progress value={((now - current.start) / (current.end - current.start)) * 100} />
          {(current.block.subtasks.length > 0 || linkedCount > 0) && (
            <div className="text-sm text-muted-foreground">
              {current.block.subtasks.length > 0 && `${doneSubs}/${current.block.subtasks.length} subtasks done`}
              {current.block.subtasks.length > 0 && linkedCount > 0 && ' · '}
              {linkedCount > 0 && `${linkedCount} task${linkedCount === 1 ? '' : 's'} in this block`}
            </div>
          )}
        </>
      ) : (
        <div className="text-xl font-semibold tracking-tight">
          {next ? 'Nothing scheduled right now' : 'Day complete'}
        </div>
      )}

      {next && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Next</Badge>
          <span className="font-medium text-foreground">{next.block.title}</span>
          <span className="tabular-nums">{formatTime12(next.block.start)}</span>
        </div>
      )}
    </Card>
  );
}

function Timeline({ blocks, isToday, onEdit }: {
  blocks: Block[]; isToday: boolean; onEdit: (b: Block) => void;
}) {
  const now = nowMinutes();
  return (
    <div className="relative space-y-3 pl-20">
      {/* The rail every block hangs off — makes the day read as a shape. */}
      <div className="absolute bottom-2 left-[4.25rem] top-2 w-px bg-border" aria-hidden />
      {blocks.map((b, i) => {
        const start = minutesOf(b.start);
        const end = endMinutesOf(b);
        const isNow = isToday && now >= start && now < end;
        const isPast = isToday && now >= end;
        const nextBlock = blocks[i + 1];
        const gap = nextBlock ? minutesOf(nextBlock.start) - end : NaN;

        return (
          <div key={b.id}>
            <div className={cn('relative', isPast && 'opacity-50')}>
              <div className="absolute -left-20 top-3 w-14 text-right">
                <div className={cn('text-xs font-semibold tabular-nums',
                  isNow ? 'text-foreground' : 'text-muted-foreground')}>
                  {formatTime12(b.start)}
                </div>
                <div className="text-xs text-muted-foreground">{formatDuration(end - start)}</div>
              </div>
              <span className={cn(
                'absolute -left-[1.42rem] top-4 size-2.5 rounded-full border-2 bg-background',
                isNow ? 'border-foreground' : 'border-border',
                isOvernight(b) && 'border-foreground ring-3 ring-muted',
              )} aria-hidden />
              <BlockCard block={b} isNow={isNow} onEdit={() => onEdit(b)} />
            </div>
            {Number.isFinite(gap) && gap >= 20 && (
              <div className="py-1 text-xs text-muted-foreground">{formatDuration(gap)} free</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BlockCard({ block: b, isNow, onEdit }: { block: Block; isNow: boolean; onEdit: () => void }) {
  const [sub, setSub] = useState('');
  const tasks = useStore((s) => s.tasks);
  const workspaces = useStore((s) => s.workspaces);
  // Linked tasks are real tasks, so ticking one here completes it everywhere.
  const linked = b.taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);
  return (
    <Card className={cn(
      'group gap-2 p-4',
      isNow && 'ring-2 ring-ring',
      b.status === 'done' && 'border-emerald-600/40 bg-emerald-600/5',
      b.status === 'missed' && 'border-red-600/40 bg-red-600/5',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={cn('font-medium leading-snug break-words',
            b.status === 'missed' && 'text-muted-foreground line-through')}>
            {b.title}
          </div>
          <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {formatTime12(b.start)} – {formatTime12(b.end)}
            {isOvernight(b) && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]" title="Ends the next day">+1</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {/* Did this actually happen? Tapping the same mark again clears it. */}
          <Button variant="ghost" size="icon" aria-pressed={b.status === 'done'}
            className={cn('size-8', b.status === 'done' && 'bg-emerald-600 text-white hover:bg-emerald-600/90')}
            aria-label={`Mark “${b.title}” done`}
            onClick={() => setBlockStatus(b.id, 'done')}>
            <Check className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-pressed={b.status === 'missed'}
            className={cn('size-8', b.status === 'missed' && 'bg-red-600 text-white hover:bg-red-600/90')}
            aria-label={`Mark “${b.title}” missed`}
            onClick={() => setBlockStatus(b.id, 'missed')}>
            <X className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-pressed={b.reminder}
            className={cn('size-8', b.reminder && 'text-foreground')}
            aria-label={b.reminder
              ? `Turn off the reminder for “${b.title}”`
              : `Remind me when “${b.title}” starts`}
            title={b.reminder ? `Reminder at ${formatTime12(b.start)}` : 'No reminder'}
            onClick={() => toggleBlockReminder(b.id)}>
            {b.reminder ? <Bell className="size-4" /> : <BellOff className="size-4 opacity-40" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit block" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Delete block"
            onClick={() => { if (confirm('Delete this block?')) deleteBlock(b.id); }}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {linked.length > 0 && (
        <div className="space-y-1 rounded-md bg-muted/50 p-2">
          {linked.map((t) => {
            const done = isTaskDoneToday(t);
            const prio = priorityOf(t.priority);
            return (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={done} onCheckedChange={() => toggleTaskDone(t.id)}
                  aria-label={t.title} />
                <span className={cn('min-w-0 flex-1 break-words',
                  done && 'text-muted-foreground line-through')}>
                  {t.title}
                </span>
                {prio && (
                  <Badge className={cn('shrink-0 px-1.5 py-0 text-[10px]', prio.className)}>
                    {prio.label}
                  </Badge>
                )}
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  {workspaces.find((w) => w.id === t.workspaceId)?.name ?? '—'}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {b.subtasks.length > 0 && (
        <div className="space-y-1">
          {b.subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={st.done} onCheckedChange={() => toggleSubtask(b.id, st.id)}
                aria-label={st.title} />
              <span className={cn('flex-1 break-words', st.done && 'text-muted-foreground line-through')}>
                {st.title}
              </span>
              <Button variant="ghost" size="icon" className="size-6" aria-label="Delete subtask"
                onClick={() => deleteSubtask(b.id, st.id)}>
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        const title = sub.trim();
        if (!title) return;
        addSubtask(b.id, title);
        setSub('');
      }}>
        <Input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add a subtask..."
          className="h-8 text-sm" />
        <Button type="submit" variant="secondary" size="icon" className="size-8" aria-label="Add subtask">
          <Plus className="size-4" />
        </Button>
      </form>
    </Card>
  );
}

/**
 * Anything due on the day being viewed, gathered from every workspace. A
 * deadline is easy to miss when it only appears inside whichever workspace the
 * task happens to live in, and the timetable is the screen actually opened.
 */
function DueToday({ date }: { date: string }) {
  const tasks = useStore((s) => s.tasks);
  const workspaces = useStore((s) => s.workspaces);

  const due = useMemo(
    () => tasks.filter((t) => t.dueDate === date && !isTaskDoneToday(t)),
    [tasks, date],
  );
  const overdue = useMemo(
    () => (date === todayStr()
      ? tasks.filter((t) => t.dueDate && t.dueDate < date && !isTaskDoneToday(t))
      : []),
    [tasks, date],
  );

  if (due.length === 0 && overdue.length === 0) return null;

  const row = (t: (typeof tasks)[number], late: boolean) => {
    const prio = priorityOf(t.priority);
    return (
      <div key={t.id} className="flex items-center gap-2.5 text-sm">
        <Checkbox checked={false} onCheckedChange={() => toggleTaskDone(t.id)}
          aria-label={`Mark ${t.title} done`} />
        <span className="min-w-0 flex-1 truncate">{t.title}</span>
        {late && (
          <Badge variant="outline" className="shrink-0 border-destructive/50 px-1.5 py-0 text-[10px] text-destructive">
            {formatDateLabel(t.dueDate!)}
          </Badge>
        )}
        {prio && (
          <Badge className={cn('shrink-0 px-1.5 py-0 text-[10px]', prio.className)}>{prio.label}</Badge>
        )}
        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
          {workspaces.find((w) => w.id === t.workspaceId)?.name ?? '—'}
        </Badge>
        {t.link && (
          <a href={t.link} target="_blank" rel="noopener noreferrer"
            aria-label={`Open the link for ${t.title}`}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    );
  };

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Due {date === todayStr() ? 'today' : formatDateLabel(date)}
        </h2>
        <span className="text-xs text-muted-foreground">
          {due.length + overdue.length} open
        </span>
      </div>
      {overdue.map((t) => row(t, true))}
      {due.map((t) => row(t, false))}
    </Card>
  );
}

/**
 * The day's meals, on the screen actually opened each morning. Editable in
 * place rather than a read-only summary, so filling in a blank slot does not
 * mean going to another tab and coming back.
 */
function EatingToday({ date }: { date: string }) {
  const meals = useStore((s) => s.meals);
  const suggestions = useMemo(() => dishSuggestions(meals), [meals]);
  const day = meals[date];
  const plannedCount = MEAL_SLOTS.filter(([slot]) => day?.[slot]).length;

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Eating {date === todayStr() ? 'today' : formatDateLabel(date).toLowerCase()}
        </h2>
        <span className="text-xs text-muted-foreground">
          {plannedCount ? `${plannedCount} of ${MEAL_SLOTS.length} planned` : 'nothing planned'}
        </span>
      </div>

      {/* Shares the id the Meals screen uses; only one is mounted at a time. */}
      <datalist id="dish-suggestions">
        {suggestions.map((d) => <option key={d} value={d} />)}
      </datalist>

      {MEAL_SLOTS.map(([slot, label]) => (
        <label key={slot} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <MealInput
            value={day?.[slot] ?? ''}
            label={`${label} on ${date}`}
            onCommit={(v) => setMeal(date, slot, v)}
          />
        </label>
      ))}
    </Card>
  );
}
