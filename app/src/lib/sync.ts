import { firebaseConfig } from './firebase-config';

/**
 * Optional cross-device sync via Firebase Auth + Firestore, loaded from
 * Google's CDN at run time so the build stays free of the SDK.
 */
export const firebaseReady = !!(
  firebaseConfig?.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_')
);

const CDN = 'https://www.gstatic.com/firebasejs/10.7.1';

let auth: any = null;
let db: any = null;
let authApi: any = null;
let firestoreApi: any = null;
let unsubscribeDoc: (() => void) | null = null;

async function ensureInitialized() {
  if (!firebaseReady || auth) return;
  const [appMod, authMod, storeMod] = await Promise.all([
    import(/* @vite-ignore */ `${CDN}/firebase-app.js`),
    import(/* @vite-ignore */ `${CDN}/firebase-auth.js`),
    import(/* @vite-ignore */ `${CDN}/firebase-firestore.js`),
  ]);
  authApi = authMod;
  firestoreApi = storeMod;
  const app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);

  // Firebase refresh tokens do not expire, so staying signed in is entirely a
  // question of whether the browser keeps the record. IndexedDB survives more
  // eviction policies than localStorage, so ask for it explicitly rather than
  // relying on whatever the SDK happens to default to.
  try {
    await authMod.setPersistence(auth, authMod.indexedDBLocalPersistence);
  } catch {
    try {
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    } catch {
      // Whatever the SDK defaults to still persists across reloads.
    }
  }

  db = storeMod.getFirestore(app);
  try {
    await storeMod.enableIndexedDbPersistence(db);
  } catch {
    // Another tab holds the lock, or the browser refuses it. Sync still works,
    // it just won't cache for full offline use.
  }
}

export async function onAuthChange(cb: (user: any) => void) {
  if (!firebaseReady) { cb(null); return () => {}; }
  await ensureInitialized();
  return authApi.onAuthStateChanged(auth, cb);
}

export async function signUp(email: string, password: string) {
  await ensureInitialized();
  return authApi.createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email: string, password: string) {
  await ensureInitialized();
  return authApi.signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  await ensureInitialized();
  stopWatchingUserDoc();
  return authApi.signOut(auth);
}

/**
 * `onRemoteChange(data)` fires with the document contents, or with null ONLY
 * when the document genuinely does not exist. A listener failure goes to
 * `onError` and never to `onRemoteChange` — reporting an error as an empty
 * cloud is what previously let one device overwrite another's data.
 */
export async function watchUserDoc(
  uid: string,
  onRemoteChange: (data: any) => void,
  onError: (err: any) => void,
) {
  await ensureInitialized();
  stopWatchingUserDoc();
  const ref = firestoreApi.doc(db, 'users', uid);
  unsubscribeDoc = firestoreApi.onSnapshot(
    ref,
    (snap: any) => onRemoteChange(snap.exists() ? snap.data() : null),
    (err: any) => onError(err),
  );
}

export function stopWatchingUserDoc() {
  if (unsubscribeDoc) { unsubscribeDoc(); unsubscribeDoc = null; }
}

export type StorageDurability = 'persisted' | 'best-effort' | 'unsupported';

/**
 * Asks the browser to exempt this origin from automatic storage eviction.
 *
 * Without it, iOS Safari clears script-writable storage after about a week of
 * not opening the site, which signs you out and takes the local data with it.
 * A site installed to the home screen is granted this far more readily, so it
 * is worth asking every launch rather than once.
 */
export async function ensurePersistentStorage(): Promise<StorageDurability> {
  const storage = navigator.storage;
  if (!storage?.persist) return 'unsupported';
  try {
    if (await storage.persisted?.()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

export async function pushState(uid: string, state: unknown) {
  await ensureInitialized();
  await firestoreApi.setDoc(firestoreApi.doc(db, 'users', uid), state);
}
