// Optional cross-device sync via Firebase Auth + Firestore, loaded from
// Google's CDN as ES modules (no npm/build step). If firebase-config.js
// still has placeholder values, `firebaseReady` is false and every export
// here becomes a safe no-op — the app runs exactly as it did before,
// local-only.

import { firebaseConfig } from './firebase-config.js';

export const firebaseReady = !!(
  firebaseConfig
  && firebaseConfig.apiKey
  && !firebaseConfig.apiKey.startsWith('YOUR_')
);

let auth = null;
let db = null;
let docRef = null;
let unsubscribeDoc = null;

let authApi = null;
let firestoreApi = null;

async function ensureInitialized() {
  if (!firebaseReady || auth) return;
  const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'),
  ]);
  authApi = authMod;
  firestoreApi = firestoreMod;
  const app = initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = firestoreMod.getFirestore(app);
  try {
    await firestoreMod.enableIndexedDbPersistence(db);
  } catch (e) {
    // Multiple tabs open, or the browser doesn't support it — sync still
    // works, it just won't cache for full offline use.
  }
}

export async function onAuthChange(callback) {
  if (!firebaseReady) { callback(null); return () => {}; }
  await ensureInitialized();
  return authApi.onAuthStateChanged(auth, callback);
}

export async function signUp(email, password) {
  await ensureInitialized();
  return authApi.createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email, password) {
  await ensureInitialized();
  return authApi.signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  await ensureInitialized();
  stopWatchingUserDoc();
  return authApi.signOut(auth);
}

/**
 * Watches the user's cloud document.
 *
 * `onRemoteChange(data)` fires with the document's contents, or with null ONLY
 * when the document genuinely does not exist yet. A listener failure goes to
 * `onError` instead and never to `onRemoteChange` -- reporting an error as an
 * empty cloud previously caused the caller to "seed" the cloud from this
 * device, overwriting whatever another device had already put there.
 */
export async function watchUserDoc(uid, onRemoteChange, onError) {
  await ensureInitialized();
  stopWatchingUserDoc();
  docRef = firestoreApi.doc(db, 'users', uid);
  unsubscribeDoc = firestoreApi.onSnapshot(
    docRef,
    (snap) => onRemoteChange(snap.exists() ? snap.data() : null),
    (err) => { if (onError) onError(err); },
  );
}

export function stopWatchingUserDoc() {
  if (unsubscribeDoc) { unsubscribeDoc(); unsubscribeDoc = null; }
  docRef = null;
}

export async function pushState(uid, state) {
  await ensureInitialized();
  const ref = firestoreApi.doc(db, 'users', uid);
  await firestoreApi.setDoc(ref, state);
}
