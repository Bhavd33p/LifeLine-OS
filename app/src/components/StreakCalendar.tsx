import { useMemo } from 'react';
import { addDaysStr, todayStr } from '@/lib/date';
import { cn } from '@/lib/utils';

const WEEKS = 17;               // roughly four months, which fits a phone width
const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

/**
 * Completion history as a week-per-column grid. A calendar shows the shape of a
 * habit — the gaps, the good runs — in a way a single streak number cannot.
 */
export function StreakCalendar({ completions }: { completions: Record<string, boolean> }) {
  const today = todayStr();

  const weeks = useMemo(() => {
    // Wind back to the Monday of the current week, then to the first column.
    const [y, m, d] = today.split('-').map(Number);
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
    const lastMonday = addDaysStr(today, -dow);
    const firstMonday = addDaysStr(lastMonday, -7 * (WEEKS - 1));
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => addDaysStr(firstMonday, w * 7 + i)));
  }, [today]);

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      <div className="flex shrink-0 flex-col gap-[3px] pr-0.5">
        {DAY_LABELS.map((l, i) => (
          <span key={i} className="h-2.5 text-[8px] leading-[10px] text-muted-foreground">{l}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="flex shrink-0 flex-col gap-[3px]">
          {week.map((date) => {
            const future = date > today;
            const hit = !!completions[date];
            return (
              <span key={date}
                title={`${date}${future ? '' : hit ? ' — done' : ' — not done'}`}
                className={cn(
                  'size-2.5 rounded-[3px]',
                  future ? 'bg-transparent'
                    : hit ? 'bg-emerald-600'
                    : 'bg-muted',
                  date === today && 'ring-1 ring-foreground ring-offset-1 ring-offset-background',
                )} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
