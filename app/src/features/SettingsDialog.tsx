import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getState, replaceState, update, useStore } from '@/lib/store';
import { firebaseReady, signIn, signOutUser, signUp } from '@/lib/sync';
import { readRemoteSnapshot, type SyncStatus } from '@/lib/useSync';
import { todayStr } from '@/lib/date';
import type { AppState } from '@/lib/types';

export function SettingsDialog({ onClose, sync, uploadNow }: {
  onClose: () => void; sync: SyncStatus; uploadNow: () => void;
}) {
  const theme = useStore((s) => s.settings.theme);
  const fileRef = useRef<HTMLInputElement>(null);
  const stashed = readRemoteSnapshot();

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Appearance, sync and your data.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={(v) =>
            update((s) => { s.settings.theme = v as AppState['settings']['theme']; })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Reminders</h3>
          <Alarms />
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Sync</h3>
          {!firebaseReady ? (
            <p className="text-sm text-muted-foreground">
              Sync is not configured, so everything stays on this device.
            </p>
          ) : sync.user ? (
            <>
              <p className="text-sm text-muted-foreground">
                Signed in as {sync.user.email}.{' '}
                {sync.syncedAt
                  ? `Last synced ${new Date(sync.syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
                  : 'No changes pushed yet this session.'}
              </p>
              {sync.error && <p className="text-sm font-medium text-destructive">Last sync error: {sync.error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const s = getState();
                  if (!confirm(`Replace the cloud copy with this device's data (${s.tasks.length} tasks, ${s.blocks.length} blocks)?`)) return;
                  uploadNow();
                }}>Upload this device now</Button>
                {stashed && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const c = stashed.state;
                    const seen = new Date(stashed.savedAt).toLocaleString();
                    if (!confirm(`Replace this device's data with the cloud copy saved at ${seen} (${c.tasks?.length ?? 0} tasks, ${c.blocks?.length ?? 0} blocks)?`)) return;
                    replaceState(c);
                    toast.success('Restored the saved cloud copy.');
                    onClose();
                  }}>Restore last cloud copy</Button>
                )}
                <Button variant="ghost" size="sm" onClick={async () => {
                  await signOutUser();
                  onClose();
                }}>Sign out</Button>
              </div>
            </>
          ) : (
            <AuthForm />
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Data</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `personal-os-backup-${todayStr()}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}>Export backup</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Import backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) { toast.error('That file is too large to be a backup.'); return; }
                const reader = new FileReader();
                reader.onerror = () => toast.error('Could not read that file.');
                reader.onload = () => {
                  let data: any;
                  try { data = JSON.parse(String(reader.result)); }
                  catch { toast.error('That file is not valid JSON.'); return; }
                  if (!data || !Array.isArray(data.workspaces) || !Array.isArray(data.tasks)) {
                    toast.error('That JSON is not a Personal OS backup.');
                    return;
                  }
                  if (!confirm(`Replace ALL current data with this backup (${data.workspaces.length} workspaces, ${data.tasks.length} tasks)? This cannot be undone.`)) return;
                  replaceState(data);
                  toast.success('Backup restored.');
                  onClose();
                };
                reader.readAsText(file);
              }} />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Alarms() {
  const alarms = useStore((s) => s.settings.alarms);
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  if (permission === 'unsupported') {
    return <p className="text-sm text-muted-foreground">This browser can't show notifications.</p>;
  }

  return (
    <div className="space-y-3">
      {permission !== 'granted' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Reminders need notification permission. They fire only while the app is open.
          </p>
          <Button size="sm" variant="outline" onClick={async () => {
            setPermission(await Notification.requestPermission());
          }}>Allow notifications</Button>
        </div>
      )}

      {alarms.map((a) => (
        <div key={a.id} className="flex items-center gap-3">
          <Checkbox checked={a.enabled} aria-label={a.label}
            onCheckedChange={(v) => update((s) => {
              const target = s.settings.alarms.find((x) => x.id === a.id);
              if (target) target.enabled = v === true;
            })} />
          <span className="min-w-0 flex-1 text-sm">{a.label}</span>
          <Input type="time" value={a.time} className="h-8 w-28"
            aria-label={`Time for ${a.label}`}
            onChange={(e) => update((s) => {
              const target = s.settings.alarms.find((x) => x.id === a.id);
              // An empty time would never match and the alarm would go silent.
              if (target && e.target.value) target.time = e.target.value;
            })} />
        </div>
      ))}
    </div>
  );
}

function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); toast.success('Signed in.'); }
    catch (e: any) { toast.error(e?.message ?? String(e)); }
    finally { setBusy(false); }
  };

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => signIn(email, password)); }}>
      <div className="space-y-2">
        <Label htmlFor="sync-email">Email</Label>
        <Input id="sync-email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sync-pass">Password (6+ characters)</Label>
        <Input id="sync-pass" type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>Sign in</Button>
        <Button type="button" variant="outline" size="sm" disabled={busy}
          onClick={() => run(() => signUp(email, password))}>Create account</Button>
      </div>
    </form>
  );
}
