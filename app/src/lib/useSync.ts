import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getState, replaceState, setAfterSave } from './store';
import {
  ensurePersistentStorage, firebaseReady, onAuthChange, pushState, stopWatchingUserDoc,
  watchUserDoc, type StorageDurability,
} from './sync';

const REMOTE_SNAPSHOT_KEY = 'personalOS.lastRemoteSnapshot';

/** The cloud copy as this device last saw it, kept so an overwrite is recoverable. */
export function readRemoteSnapshot(): { savedAt: number; state: any } | null {
  try {
    const raw = localStorage.getItem(REMOTE_SNAPSHOT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.state ? parsed : null;
  } catch { return null; }
}

function stashRemoteSnapshot(state: any) {
  try {
    localStorage.setItem(REMOTE_SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), state }));
  } catch { /* a safety net, not a requirement */ }
}

export interface SyncStatus {
  user: any;
  error: string | null;
  syncedAt: number | null;
  conflict: any | null;
  /** Whether the browser has promised not to evict this app's storage. */
  storage: StorageDurability | 'unknown';
}

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>({
    user: null, error: null, syncedAt: null, conflict: null, storage: 'unknown',
  });
  const applying = useRef(false);
  const userRef = useRef<any>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Asked every launch, not once: a browser that refused before may grant it
    // after the app is installed to the home screen, and being evicted is what
    // signs you out and takes the local data with it.
    ensurePersistentStorage().then((storage) => setStatus((s) => ({ ...s, storage })));
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;

    setAfterSave(() => {
      if (!userRef.current || applying.current) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        pushState(userRef.current.uid, getState())
          .then(() => setStatus((s) => ({ ...s, error: null, syncedAt: Date.now() })))
          .catch((e) => setStatus((s) => ({ ...s, error: e?.message ?? String(e) })));
      }, 600);
    });

    let cancelled = false;
    onAuthChange(async (user) => {
      if (cancelled) return;
      userRef.current = user;
      setStatus((s) => ({ ...s, user }));
      if (!user) { stopWatchingUserDoc(); return; }

      let first = true;
      await watchUserDoc(user.uid, (remote) => {
        const wasFirst = first;
        first = false;

        if (!remote) {
          // The document genuinely does not exist, so there is nothing to lose
          // by seeding it. A listener failure lands in onError instead, which
          // is exactly why that path can never reach this push.
          pushState(user.uid, getState())
            .catch((e) => setStatus((s) => ({ ...s, error: e?.message ?? String(e) })));
          return;
        }

        stashRemoteSnapshot(remote);

        // The first snapshot after signing in is the only moment two
        // independent histories meet. Taking the remote blindly would destroy
        // whatever this device made before signing in, so ask instead.
        const local = getState();
        const hasLocal = local.tasks.length > 0 || local.blocks.length > 0
          || Object.keys(local.meals).length > 0;
        if (wasFirst && hasLocal && JSON.stringify(remote) !== JSON.stringify(local)) {
          setStatus((s) => ({ ...s, conflict: remote }));
          return;
        }

        applying.current = true;
        replaceState(remote, { silent: true });
        applying.current = false;
      }, (err) => {
        // A failed listener means we do not know what the cloud holds, so the
        // only safe move is to say so and change nothing.
        const msg = err?.message ?? String(err);
        setStatus((s) => ({ ...s, error: msg }));
        toast.error(`Sync paused: ${msg}`);
      });
    });

    return () => {
      cancelled = true;
      setAfterSave(null);
      stopWatchingUserDoc();
    };
  }, []);

  const resolveConflict = (keep: 'local' | 'cloud') => {
    const remote = status.conflict;
    setStatus((s) => ({ ...s, conflict: null }));
    if (keep === 'cloud') {
      applying.current = true;
      replaceState(remote, { silent: true });
      applying.current = false;
      toast.success('This device now matches the cloud.');
      return;
    }
    if (!userRef.current) return;
    pushState(userRef.current.uid, getState())
      .then(() => toast.success('Cloud updated from this device.'))
      .catch((e) => toast.error(`Could not update cloud: ${e?.message ?? e}`));
  };

  const uploadNow = () => {
    if (!userRef.current) return;
    pushState(userRef.current.uid, getState())
      .then(() => {
        setStatus((s) => ({ ...s, error: null, syncedAt: Date.now() }));
        toast.success('Cloud updated from this device.');
      })
      .catch((e) => toast.error(`Could not upload: ${e?.message ?? e}`));
  };

  return { status, resolveConflict, uploadNow };
}
