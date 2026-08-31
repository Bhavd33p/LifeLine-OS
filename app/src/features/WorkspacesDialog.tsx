import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { addLabel, removeLabel, uid, update, useStore } from '@/lib/store';
import { workspaceIcon } from '@/lib/icons';

export function WorkspacesDialog({ onClose }: { onClose: () => void }) {
  const workspaces = useStore((s) => s.workspaces);
  const tasks = useStore((s) => s.tasks);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Workspaces</DialogTitle>
          <DialogDescription>
            Built-in workspaces can be renamed. Ones you add can also be removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {workspaces.map((w) => {
            const Icon = workspaceIcon(w.id);
            const count = tasks.filter((t) => t.workspaceId === w.id).length;
            return (
              <div key={w.id} className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <Input value={w.name} className="h-8"
                  aria-label={`Rename ${w.name}`}
                  onChange={(e) => {
                    const next = e.target.value;
                    update((s) => {
                      const target = s.workspaces.find((x) => x.id === w.id);
                      // An empty name would render an unclickable tab.
                      if (target) target.name = next || target.name;
                    });
                  }} />
                <Button variant="ghost" size="icon" className="size-8 shrink-0"
                  aria-label={`Delete ${w.name}`} disabled={!!w.system}
                  title={w.system ? 'Built-in workspaces cannot be deleted' : undefined}
                  onClick={() => {
                    if (!confirm(`Delete “${w.name}”${count ? ` and its ${count} task${count === 1 ? '' : 's'}` : ''}? This cannot be undone.`)) return;
                    update((s) => {
                      s.workspaces = s.workspaces.filter((x) => x.id !== w.id);
                      s.tasks = s.tasks.filter((t) => t.workspaceId !== w.id);
                    });
                    toast.success(`Removed ${w.name}.`);
                  }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <Separator />

        <Labels />

        <Separator />

        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const label = name.trim();
          if (!label) return;
          update((s) => {
            // Before Stats, which is always meant to be the last tab.
            const statsIdx = s.workspaces.findIndex((w) => w.id === 'stats');
            const at = statsIdx === -1 ? s.workspaces.length : statsIdx;
            s.workspaces.splice(at, 0, {
              id: uid(), name: label, icon: emoji || '📁', type: 'tasks',
            });
          });
          setName('');
          toast.success(`Added ${label}.`);
        }}>
          <Label htmlFor="ws-name">New workspace</Label>
          <div className="flex gap-2">
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)}
              className="w-14 text-center" maxLength={2} aria-label="Workspace emoji" />
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Reading, Finances, ..." />
            <Button type="submit">Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Labels are shared across every workspace, which is what makes them useful for
 * something cutting across them — a platform like Instagram or X, say, tagged
 * on posts in Content and on anything related elsewhere.
 */
function Labels() {
  const labels = useStore((s) => s.labels);
  const tasks = useStore((s) => s.tasks);
  const [name, setName] = useState('');

  return (
    <section className="space-y-2">
      <Label htmlFor="label-name">Labels</Label>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const used = tasks.filter((t) => t.labels.includes(l)).length;
          return (
            <Badge key={l} variant="secondary" className="gap-1 pr-1">
              {l}
              <button type="button" aria-label={`Remove the ${l} label`}
                className="rounded-full p-0.5 hover:bg-background/60"
                onClick={() => {
                  if (used && !confirm(`Remove “${l}” from ${used} task${used === 1 ? '' : 's'}?`)) return;
                  removeLabel(l);
                }}>
                <X className="size-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!addLabel(name)) {
          if (name.trim()) toast.error(`“${name.trim()}” already exists.`);
          return;
        }
        setName('');
      }}>
        <Input id="label-name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Instagram, X, LinkedIn..." className="h-8" />
        <Button type="submit" size="sm" variant="outline">Add</Button>
      </form>
    </section>
  );
}
