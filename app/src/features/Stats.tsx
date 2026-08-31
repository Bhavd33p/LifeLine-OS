import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { isTaskDoneToday, streakOf, useStore } from '@/lib/store';
import { addDaysStr, formatDayShort, todayStr } from '@/lib/date';

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
        <h2 className="text-sm font-semibold">Timetable, last 7 days</h2>
        <div className="space-y-1">
          {last7.map((d) => {
            const n = state.blocks.filter((b) => b.date === d).length;
            return (
              <div key={d} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{formatDayShort(d)}</span>
                <span className="tabular-nums">{n ? `${n} block${n === 1 ? '' : 's'}` : '—'}</span>
              </div>
            );
          })}
        </div>
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
