# Setting up cross-device sync

Personal OS works fully local-only out of the box — nothing below is
required to use the app. This is only for turning on sync, so the same
data shows up whether you open the app on your phone or your laptop.

It uses Firebase (Google's app backend platform): **Authentication**
(email/password) to know who you are, and **Firestore** (a cloud
database) to store your data. The free "Spark" tier is enough for one
person's use — no credit card required.

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and sign in with a Google account.
2. **Add project** → name it anything (e.g. `personal-os`) → you can
   disable Google Analytics, it's not needed → **Create project**.

## 2. Register a web app

1. In the project overview, click the **web icon** (`</>`).
2. Give it a nickname (e.g. "Personal OS") → **Register app**.
3. Firebase shows a `firebaseConfig` object — copy it.

## 3. Paste the config into this repo

Open `web/firebase-config.js` and replace the placeholder values with the
ones you just copied:

```js
export const firebaseConfig = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '...',
  appId: '...',
};
```

These values are safe to commit to a repo, even a public one — a Firebase
web config is not a secret. Access is controlled by the security rules
below and by Authentication, not by hiding this file.

## 4. Turn on Email/Password sign-in

In the Firebase console: **Build → Authentication → Get started →
Sign-in method** → enable **Email/Password**.

## 5. Create the Firestore database

**Build → Firestore Database → Create database** → start in **production
mode** → pick a region close to you → **Enable**.

## 6. Set the security rules

Still in Firestore, go to the **Rules** tab, replace the contents with the
rules below, and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This means: a signed-in user can only ever read or write their *own*
document (`users/{their uid}`) — nobody else's data is reachable, even
though the API key itself is public.

## 7. Sign in from the app

Reload the app (or re-deploy it if you've hosted it). Open **Settings →
Sync across devices** — you'll now see an email/password form instead of
the "not set up yet" message. **Create account** once; on any other
device, open the app and **Sign in** with the same email/password.

Your existing local data on the first device becomes the initial cloud
copy automatically. Signing in on a second device pulls that same data
down — from then on, changes on either device sync to the other within
about a second while both are online.

## How it works

- One Firestore document per account (`users/{uid}`) holds your entire
  app state as JSON — same shape as an exported backup.
- Every local change is pushed after a short debounce (600ms of no further
  edits) so rapid changes don't spam writes.
- A real-time listener (`onSnapshot`) picks up changes made on other
  devices and merges them in immediately.
- Firestore's built-in offline persistence means the app keeps working
  without a connection — changes queue up and sync once you're back
  online.
- This is last-write-wins, not a merge of concurrent edits — fine for one
  person using a couple of devices, not designed for simultaneous editing
  from two devices at once.

## Turning it off

Sign out from Settings, or just don't fill in `firebase-config.js` at
all — the app checks whether the API key still looks like a placeholder
and skips loading Firebase entirely when it does. No network calls to
Firebase happen until you configure it.
