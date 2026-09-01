import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Holds a local draft so typing stays snappy and storage is only written on
 * blur, but adopts the stored value whenever it changes underneath — which is
 * what "Copy last week", an incoming cloud sync, and editing the same slot from
 * the other screen all do. An uncontrolled input would keep showing stale text.
 */
export function MealInput({ value, label, onCommit }: {
  value: string; label: string; onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    // Never yank text out from under someone mid-edit.
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <Input
      value={draft}
      list="dish-suggestions"
      placeholder="Not planned"
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; onCommit(draft); }}
      className="h-8 border-0 border-b border-transparent px-1 shadow-none focus-visible:border-ring focus-visible:ring-0"
    />
  );
}
