import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PRIORITIES, type PriorityId, priorityOf } from '@/lib/store';
import { cn } from '@/lib/utils';

/**
 * The four tiers plus their meaning. Shared by quick-add and the task editor so
 * the definitions can never drift between the two places they are chosen.
 */
export function PriorityPicker({ value, onChange }: {
  value: PriorityId | null;
  onChange: (v: PriorityId | null) => void;
}) {
  const chosen = priorityOf(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Priority
        </span>
        {PRIORITIES.map((p) => {
          const active = value === p.id;
          return (
            <button key={p.id} type="button" aria-pressed={active}
              title={`${p.label} — ${p.name}: ${p.definition}`}
              onClick={() => onChange(active ? null : p.id)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
                active ? p.className : 'border-border text-muted-foreground hover:bg-accent',
              )}>
              {p.label}
            </button>
          );
        })}
        {/* A phone has no hover, so the definitions need a tap target of their own. */}
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
  );
}
