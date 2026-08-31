import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { StreakCalendar } from '@/components/StreakCalendar';
import { isTaskDoneToday, reportFor, streakOf, useStore } from '@/lib/store';
import { addDaysStr, formatDateLabel, todayStr } from '@/lib/date';
import { cn } from '@/lib/utils';

export function Stats() {
  const state = useStore((s) => s);
  const today = todayStr();
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysStr(today, -i));

  const completed7 = state.tasks.filter(
    (t) => (t.completedAt && t.completedAt >= Date.now() - 7 * 864e5)
      || last7.some((d) => t.completions[d]),
  ).length;
  const plannedDays = last7.filter((d) => state.blocks.some((b) => b.date === d)).length;
  const streaks = state.tasks
    .filter((t) => t.recurrence !== 'none' && streakOf(t) > 0)
    .sort((a, b) => streakOf(b) - streakOf(a));

  const taskWorkspaces = state.workspaces.filter((w) => w.type === 'tasks');

  // Oldest first, so the report reads left to right like a week does.
  const reports = last7.map((d) => reportFor(state, d)).reverse();
  const marked = reports.reduce((a, r) => a + r.done + r.missed, 0);
  const overall = marked
    ? (reports.reduce((a, r) => a + r.done, 0) / marked) * 100
    : null;
  const habits = state.tasks
    .filter((t) => t.recurrence !== 'none')
    .sort((a, b) => streakOf(b) - streakOf(a));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Completed, last 7 days" value={String(completed7)} />
        <Tile label="Days planned, last 7" value={`${plannedDays}/7`} />
      </div>

      <Card className="gap-3 p-4">
        <h2 className="text-sm font-semibold">Completion by workspace</h2>
        {taskWorkspaces.map((w) => {
          const all = state.tasks.filter((t) => t.workspaceId === w.id);
          const done = all.filter(isTaskDoneToday).length;
          const pct = all.length ? (done / all.length) * 100 : 0;
          return (
            <div key={w.id} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{w.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {all.length ? `${done}/${all.length}` : '—'}
                </span>
              </div>
              <Progress value={pct} />
            </div>
          );
        })}
      </Card>

      <Card className="gap-3 p-4">
        <h2 className="text-sm font-semibold">Streaks</h2>
        {streaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active streaks. Give a task a daily or weekly repeat to start one.
          </p>
        ) : streaks.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{t.title}</span>
            <Badge variant="secondary" className="tabular-nums">{streakOf(t)} days</Badge>
          </div>
        ))}
      </Card>

      <Card className="gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Daily report</h2>
          <span className="text-xs text-muted-foreground">
            {overall === null ? 'nothing marked yet' : `${Math.round(overall)}% done, last 7 days`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tick or cross each block on the timetable. The rate counts only what you marked,
          so a half-marked day isn't punished for the blocks you never judged.
        </p>
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.date} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={cn('text-muted-foreground', r.date === today && 'font-semibold text-foreground')}>
                  {formatDateLabel(r.date)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {r.total === 0 ? 'nothing planned'
                    : `${r.done}/${r.done + r.missed || r.total}${r.unmarked ? ` · ${r.unmarked} unmarked` : ''}`}
                </span>
              </div>
              {/* One bar per day: green done, red missed, grey never marked. */}
              <div className="flex h-2 gap-px overflow-hidden rounded-full bg-muted">
                {r.total > 0 && (
                  <>
                    <span className="bg-emerald-600" style={{ width: `${(r.done / r.total) * 100}%` }} />
                    <span className="bg-red-600" style={{ width: `${(r.missed / r.total) * 100}%` }} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="text-sm font-semibold">Habit calendars</h2>
        {habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No repeating tasks yet. Open a task and set it to repeat daily — Gym or CP/DSA,
            say — and its calendar shows up here.
          </p>
        ) : habits.map((t) => (
          <div key={t.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">{t.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                <b className="text-foreground tabular-nums">{streakOf(t)}</b> day streak
                {' · '}
                <span className="tabular-nums">{Object.keys(t.completions).length}</span> total
              </span>
            </div>
            <StreakCalendar completions={t.completions} />
          </div>
        ))}
      </Card>

      {state.tasks.length === 0 && state.blocks.length === 0 && (
        <EmptyState title="Nothing to measure yet" body="Add some tasks or plan a day, and this fills in." />
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground text-balance">{label}</div>
    </Card>
  );
}
