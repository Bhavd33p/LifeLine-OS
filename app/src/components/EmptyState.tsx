import { Inbox } from 'lucide-react';

/** One shared empty state, so "nothing here yet" reads the same everywhere. */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <Inbox className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-xs text-sm text-balance text-muted-foreground">{body}</p>}
    </div>
  );
}
