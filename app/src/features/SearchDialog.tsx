import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { formatDateLabel, formatTime12 } from '@/lib/date';

/** Searches task and block titles, and jumps to whatever is picked. */
export function SearchDialog({ onClose, onPick }: {
  onClose: () => void;
  onPick: (target: { workspaceId: string } | { timetableDate: string }) => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const workspaces = useStore((s) => s.workspaces);
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const { taskHits, blockHits } = useMemo(() => {
    if (!query) return { taskHits: [], blockHits: [] };
    return {
      taskHits: tasks.filter((t) => t.title.toLowerCase().includes(query)).slice(0, 20),
      blockHits: blocks.filter((b) => b.title.toLowerCase().includes(query)).slice(0, 20),
    };
  }, [query, tasks, blocks]);

  const nothing = query && taskHits.length === 0 && blockHits.length === 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Search</DialogTitle></DialogHeader>

        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks and timetable blocks..." />

        {!query && (
          <p className="text-sm text-muted-foreground">
            Type to search across every workspace and every planned day.
          </p>
        )}
        {nothing && <p className="text-sm text-muted-foreground">Nothing matches “{q}”.</p>}

        {taskHits.length > 0 && (
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks</h3>
            {taskHits.map((t) => (
              <button key={t.id} type="button"
                onClick={() => { onPick({ workspaceId: t.workspaceId }); onClose(); }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                <span className="min-w-0 truncate">{t.title}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {workspaces.find((w) => w.id === t.workspaceId)?.name ?? '—'}
                </Badge>
              </button>
            ))}
          </section>
        )}

        {blockHits.length > 0 && (
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Timetable blocks
            </h3>
            {blockHits.map((b) => (
              <button key={b.id} type="button"
                onClick={() => { onPick({ timetableDate: b.date }); onClose(); }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                <span className="min-w-0 truncate">{b.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateLabel(b.date)} · {formatTime12(b.start)}
                </span>
              </button>
            ))}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
