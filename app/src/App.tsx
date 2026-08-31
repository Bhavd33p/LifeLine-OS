import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Search, Settings as SettingsIcon } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Timetable } from '@/features/Timetable';
import { TaskWorkspace } from '@/features/TaskWorkspace';
import { Meals } from '@/features/Meals';
import { Stats } from '@/features/Stats';
import { SettingsDialog } from '@/features/SettingsDialog';
import { SearchDialog } from '@/features/SearchDialog';
import { WorkspacesDialog } from '@/features/WorkspacesDialog';
import { LAST_WORKSPACE_KEY, MEAL_SLOTS, countPlannedMeals, isTaskDoneToday, useStore } from '@/lib/store';
import { addDaysStr, todayStr } from '@/lib/date';
import { workspaceIcon } from '@/lib/icons';
import { useTheme } from '@/lib/useTheme';
import { useSync } from '@/lib/useSync';
import { useAlarms } from '@/lib/useAlarms';
import { cn } from '@/lib/utils';

export default function App() {
  const state = useStore((s) => s);
  const { workspaces } = state;
  useTheme(state.settings.theme);
  const { status: sync, resolveConflict, uploadNow } = useSync();

  const [wsId, setWsId] = useState(
    () => localStorage.getItem(LAST_WORKSPACE_KEY) || 'timetable',
  );
  const [ttDate, setTtDate] = useState(todayStr);
  const [mealStart, setMealStart] = useState(todayStr);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  useAlarms();

  // A stale stored id used to blank the screen; fall back to the first tab.
  const ws = workspaces.find((w) => w.id === wsId) ?? workspaces[0];

  useEffect(() => {
    if (ws) localStorage.setItem(LAST_WORKSPACE_KEY, ws.id);
  }, [ws]);

  const tomorrow = addDaysStr(todayStr(), 1);
  const tomorrowPlanned = state.blocks.some((b) => b.date === tomorrow);
  // Not worth saying when you are already looking at tomorrow.
  const onTomorrow = ws?.type === 'timetable' && ttDate === tomorrow;

  const subtitle = useMemo(() => {
    if (!ws) return '';
    if (ws.type === 'timetable') {
      const n = state.blocks.filter((b) => b.date === ttDate).length;
      return n ? `${n} block${n === 1 ? '' : 's'} planned` : 'Nothing planned';
    }
    if (ws.type === 'stats') return 'Your last 7 days';
    if (ws.type === 'meals') {
      const days = Array.from({ length: 7 }, (_, i) => addDaysStr(mealStart, i));
      const planned = countPlannedMeals(state, days);
      const total = 7 * MEAL_SLOTS.length;
      return planned ? `${planned} of ${total} meals planned` : 'Nothing planned yet';
    }
    const all = state.tasks.filter((t) => t.workspaceId === ws.id);
    const open = all.filter((t) => !isTaskDoneToday(t)).length;
    return all.length ? `${open} open · ${all.length} total` : 'No tasks yet';
  }, [ws, state, ttDate, mealStart]);

  if (!ws) return null;

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{ws.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {sync.error && (
          <span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive">
            Sync paused
          </span>
        )}
        <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setSearchOpen(true)}>
          <Search />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Manage workspaces" onClick={() => setWsOpen(true)}>
          <LayoutGrid />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
        </Button>
      </header>

      {!tomorrowPlanned && !onTomorrow && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span>Tomorrow's timetable isn't planned yet.</span>
          <Button size="sm" variant="secondary" onClick={() => {
            setTtDate(tomorrow);
            setWsId('timetable');
          }}>Plan it</Button>
        </div>
      )}

      <main className="py-4">
        {ws.type === 'timetable' && <Timetable date={ttDate} setDate={setTtDate} />}
        {ws.type === 'tasks' && <TaskWorkspace ws={ws} />}
        {ws.type === 'meals' && <Meals start={mealStart} setStart={setMealStart} />}
        {ws.type === 'stats' && <Stats />}
      </main>

      <nav aria-label="Workspaces"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 py-1.5">
          {workspaces.map((w) => {
            const Icon = workspaceIcon(w.id);
            const active = w.id === ws.id;
            return (
              <button key={w.id} type="button" onClick={() => setWsId(w.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-16 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50',
                )}>
                <Icon className="size-5" />
                <span className="max-w-full truncate">{w.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} sync={sync} uploadNow={uploadNow} />
      )}
      {wsOpen && <WorkspacesDialog onClose={() => setWsOpen(false)} />}
      {searchOpen && (
        <SearchDialog onClose={() => setSearchOpen(false)} onPick={(target) => {
          if ('workspaceId' in target) { setWsId(target.workspaceId); return; }
          setTtDate(target.timetableDate);
          setWsId('timetable');
        }} />
      )}

      {sync.conflict && (
        <Dialog open>
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Which copy should win?</DialogTitle>
              <DialogDescription>
                This device and your cloud account both have data, and they differ.
                The one you don't pick will be replaced.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p><b>This device:</b> {state.tasks.length} tasks · {state.blocks.length} blocks</p>
              <p><b>The cloud:</b> {sync.conflict.tasks?.length ?? 0} tasks · {sync.conflict.blocks?.length ?? 0} blocks</p>
              <p className="text-muted-foreground">
                Not sure? Export a backup from Settings → Data first — the cloud copy is
                also kept on this device and can be restored later.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => resolveConflict('local')}>
                Keep this device
              </Button>
              <Button onClick={() => resolveConflict('cloud')}>Use the cloud</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Toaster position="top-center" richColors />
    </div>
  );
}
