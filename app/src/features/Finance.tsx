import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import {
  MONEY_CATEGORIES, MONEY_KINDS, addMoney, deleteMoney, monthOf, summariseMonth, useStore,
} from '@/lib/store';
import { formatDayShort, todayStr } from '@/lib/date';
import type { MoneyKind } from '@/lib/types';
import { cn } from '@/lib/utils';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});
const fmt = (n: number) => money.format(n);

const KIND_STYLE: Record<MoneyKind, string> = {
  expense: 'bg-red-600 text-white border-red-600',
  income: 'bg-emerald-600 text-white border-emerald-600',
  investment: 'bg-sky-600 text-white border-sky-600',
};

/** Shifts a 'YYYY-MM' by whole months. */
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function Finance() {
  const state = useStore((s) => s);
  const [month, setMonth] = useState(() => monthOf(todayStr()));
  const summary = useMemo(() => summariseMonth(state, month), [state, month]);
  const thisMonth = monthOf(todayStr());

  const spentToday = useMemo(
    () => state.money.filter((m) => m.date === todayStr() && m.kind === 'expense')
      .reduce((a, m) => a + m.amount, 0),
    [state.money],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
        <button type="button" onClick={() => setMonth(thisMonth)} title="Jump to this month"
          className="flex-1 rounded-lg px-3 py-1.5 text-center transition-colors hover:bg-accent">
          <div className="text-base font-semibold tracking-tight">{monthLabel(month)}</div>
          <div className="text-xs text-muted-foreground">
            {summary.entries.length} entr{summary.entries.length === 1 ? 'y' : 'ies'}
          </div>
        </button>
        <Button variant="outline" size="icon" aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
      </div>

      <AddEntry month={month} />

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Spent" value={fmt(summary.expense)} tone="text-red-600 dark:text-red-400" />
        <Tile label="Invested" value={fmt(summary.invested)} tone="text-sky-600 dark:text-sky-400" />
        <Tile label="Left" value={fmt(summary.net)}
          tone={summary.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
      </div>

      {month === thisMonth && (
        <Card className="gap-1 p-4">
          <div className="text-xs text-muted-foreground">Spent today</div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight">{fmt(spentToday)}</div>
          {summary.daysWithSpend > 0 && (
            <div className="text-xs text-muted-foreground">
              {fmt(Math.round(summary.expense / summary.daysWithSpend))} average on the
              {' '}{summary.daysWithSpend} day{summary.daysWithSpend === 1 ? '' : 's'} you spent
            </div>
          )}
        </Card>
      )}

      <PerDay summary={summary} />
      <Breakdown title="Where it went" rows={summary.spentByCategory} total={summary.expense} bar="bg-red-600" />
      <Breakdown title="Invested in" rows={summary.investedByCategory} total={summary.invested} bar="bg-sky-600" />

      <Card className="gap-2 p-4">
        <h2 className="text-sm font-semibold">Ledger</h2>
        {summary.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded this month.</p>
        ) : summary.entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2.5 border-b py-2 text-sm last:border-b-0">
            <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatDayShort(e.date).replace(/^\w+ /, '')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{e.category}</span>
              {e.note && <span className="block truncate text-xs text-muted-foreground">{e.note}</span>}
            </span>
            <span className={cn('shrink-0 tabular-nums',
              e.kind === 'expense' ? 'text-red-600 dark:text-red-400'
                : e.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-sky-600 dark:text-sky-400')}>
              {e.kind === 'income' ? '+' : e.kind === 'expense' ? '−' : ''}{fmt(e.amount)}
            </span>
            <Button variant="ghost" size="icon" className="size-8 shrink-0"
              aria-label={`Delete ${e.category} entry`}
              onClick={() => { if (confirm(`Delete this ${fmt(e.amount)} entry?`)) deleteMoney(e.id); }}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </Card>

      {state.money.length === 0 && (
        <EmptyState title="No money tracked yet"
          body="Add what you spend as you go. The daily view and the breakdown fill in from it." />
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="gap-1 p-3">
      <div className={cn('text-lg font-semibold tabular-nums tracking-tight', tone)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </Card>
  );
}

/** Spend per day across the month, so a heavy day is obvious at a glance. */
function PerDay({ summary }: { summary: ReturnType<typeof summariseMonth> }) {
  const max = Math.max(...summary.perDay.map((d) => d.total), 1);
  const today = todayStr();
  if (summary.expense === 0) return null;

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Day by day</h2>
        {summary.busiestDay && (
          <span className="text-xs text-muted-foreground">
            most on {formatDayShort(summary.busiestDay.date).replace(/^\w+ /, '')}
            {' · '}{fmt(summary.busiestDay.total)}
          </span>
        )}
      </div>
      <div className="flex h-24 items-end gap-[3px]">
        {summary.perDay.map((d) => (
          <div key={d.date} className="group relative flex-1"
            title={`${formatDayShort(d.date)} — ${fmt(d.total)}`}>
            <div className={cn('w-full rounded-sm transition-colors',
              d.total === 0 ? 'bg-muted' : 'bg-red-600/80',
              d.date === today && 'ring-1 ring-foreground ring-offset-1 ring-offset-background')}
              style={{ height: `${Math.max(d.total === 0 ? 2 : 6, (d.total / max) * 96)}px` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>1</span><span>{summary.perDay.length}</span>
      </div>
    </Card>
  );
}

function Breakdown({ title, rows, total, bar }: {
  title: string; rows: { category: string; total: number }[]; total: number; bar: string;
}) {
  if (rows.length === 0) return null;
  return (
    <Card className="gap-2.5 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.map((r) => (
        <div key={r.category} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>{r.category}</span>
            <span className="tabular-nums text-muted-foreground">
              {fmt(r.total)} · {Math.round((r.total / total) * 100)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', bar)}
              style={{ width: `${(r.total / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function AddEntry({ month }: { month: string }) {
  const [kind, setKind] = useState<MoneyKind>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(MONEY_CATEGORIES.expense[0]);
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');

  return (
    <Card className="gap-3 p-3">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const value = Number(amount);
        if (!(value > 0)) return;
        addMoney(date, value, kind, category, note.trim());
        // Amount and note clear; the kind, category and date stay, which suits
        // entering a run of the day's spending in one sitting.
        setAmount('');
        setNote('');
      }}>
        <div className="flex gap-1.5">
          {MONEY_KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id}
              onClick={() => { setKind(k.id); setCategory(MONEY_CATEGORIES[k.id][0]); }}
              className={cn('flex-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                kind === k.id ? KIND_STYLE[k.id] : 'border-border text-muted-foreground hover:bg-accent')}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input type="number" inputMode="decimal" min={1} step={1} value={amount} required
            placeholder="Amount" aria-label="Amount" className="w-28"
            onChange={(e) => setAmount(e.target.value)} />
          {/* Keyed by kind: every option is replaced when the kind changes, and a
              controlled Select whose whole item set is swapped underneath it
              drops its value. Remounting keeps the new default selected. */}
          <Select key={kind} value={category} onValueChange={setCategory}>
            <SelectTrigger className="flex-1" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONEY_CATEGORIES[kind].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Input type="date" value={date} aria-label="Date" className="w-40"
            onChange={(e) => setDate(e.target.value)} />
          <Input value={note} placeholder="Note (optional)" aria-label="Note"
            onChange={(e) => setNote(e.target.value)} />
        </div>

        {monthOf(date) !== month && (
          <p className="text-xs text-muted-foreground">
            This date is outside {monthLabel(month)}, so it will show in that month instead.
          </p>
        )}

        <Button type="submit" className="w-full">Add</Button>
      </form>
    </Card>
  );
}
