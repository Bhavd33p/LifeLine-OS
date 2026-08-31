import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  MEAL_SLOTS, copyPreviousWeekMeals, dishSuggestions, setMeal, useStore,
} from '@/lib/store';
import { addDaysStr, formatDateLabel, formatDayShort, todayStr } from '@/lib/date';
import { cn } from '@/lib/utils';

/** Rolling seven days from `start` — "the coming week" begins today, not Monday. */
export function Meals({ start, setStart }: { start: string; setStart: (d: string) => void }) {
  const meals = useStore((s) => s.meals);
  const suggestions = useStore(dishSuggestions);
  const today = todayStr();

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysStr(start, i)),
    [start],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week"
          onClick={() => setStart(addDaysStr(start, -7))}>
          <ChevronLeft />
        </Button>
        <button type="button" onClick={() => setStart(today)} title="Jump back to today"
          className="flex-1 rounded-lg px-3 py-1.5 text-center transition-colors hover:bg-accent">
          <div className="text-base font-semibold tracking-tight">
            {start === today ? 'Next 7 days' : `${formatDateLabel(start)} onward`}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDayShort(days[0])} – {formatDayShort(days[6])}
          </div>
        </button>
        <Button variant="outline" size="icon" aria-label="Next week"
          onClick={() => setStart(addDaysStr(start, 7))}>
          <ChevronRight />
        </Button>
      </div>

      <Button variant="outline" size="sm" onClick={() => {
        const filled = copyPreviousWeekMeals(days);
        if (!filled) { toast.error('The 7 days before this week have nothing planned.'); return; }
        toast.success(`Filled ${filled} empty slot${filled === 1 ? '' : 's'} from last week.`);
      }}>
        <CopyPlus /> Copy last week
      </Button>

      {/* Suggestions come from dishes already planned, so repeat meals are one keystroke. */}
      <datalist id="dish-suggestions">
        {suggestions.map((d) => <option key={d} value={d} />)}
      </datalist>

      <div className="grid gap-3 sm:grid-cols-2">
        {days.map((date) => {
          const isToday = date === today;
          return (
            <Card key={date} className={cn('gap-2 p-4', isToday && 'ring-2 ring-ring',
              date < today && 'opacity-60')}>
              <div className="flex items-baseline justify-between gap-2 border-b pb-2">
                <div className={cn('font-semibold tracking-tight', isToday && 'text-foreground')}>
                  {formatDateLabel(date)}
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">{formatDayShort(date)}</div>
              </div>
              {MEAL_SLOTS.map(([slot, label]) => (
                <label key={slot} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                  <Input
                    defaultValue={meals[date]?.[slot] ?? ''}
                    list="dish-suggestions"
                    placeholder="Not planned"
                    aria-label={`${label} on ${formatDayShort(date)}`}
                    // Committed on blur rather than per keystroke: 28 fields all
                    // writing to storage on every character is needless churn.
                    onBlur={(e) => setMeal(date, slot, e.target.value)}
                    className="h-8 border-0 border-b border-transparent px-1 shadow-none focus-visible:border-ring focus-visible:ring-0"
                  />
                </label>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
