import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { BlockDialog } from './BlockDialog';
import { EmptyState } from '@/components/EmptyState';
import {
  addDaysStr, endMinutesOf, formatDateLabel, formatDuration, formatTime12,
  isOvernight, minutesOf, nowMinutes, todayStr,
} from '@/lib/date';
import {
  addSubtask, deleteBlock, deleteSubtask, getState, loadTemplateIntoDay,
  saveDayAsTemplate, setBlockStatus, toggleSubtask, useStore,
} from '@/lib/store';
import type { Block } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function Timetable({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const blocks = useStore((s) => s.blocks);
  const [editing, setEditing] = useState<Block | null | undefined>(undefined);

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
          {current.block.subtasks.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {doneSubs}/{current.block.subtasks.length} subtasks done
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
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit block" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Delete block"
            onClick={() => { if (confirm('Delete this block?')) deleteBlock(b.id); }}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

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
