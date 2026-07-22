# Personal OS — Web

A browser-based, installable version of Personal OS. Pure HTML/CSS/JS, no
build step, no backend — everything is stored in the browser
(`localStorage`) on your device.

This exists because a real installable iOS app requires Xcode on a Mac,
which wasn't available to build it here. A PWA is the practical
alternative: open it in Safari on your iPhone, tap **Share → Add to Home
Screen**, and it launches full-screen with its own icon like a native app.
It also works as an installable app on Android/desktop Chrome (address
bar → Install).

## Concepts

- **Workspaces** — switchable containers along the top: Timetable (special),
  Tasks, Health, CP / DSA, Skincare, Gym, plus any custom ones you add with
  **+ Workspace**.
- **Tasks** — live inside a workspace, each with a title, notes, any
  number of **labels** (Important, Today, Tomorrow, Office, Personal by
  default), a **priority** (Low/Medium/High), an optional **due date and
  time**, and an optional **repeat** (Daily/Weekly). A repeating task
  tracks a completion per day and builds a **streak**, same idea as a
  habit tracker. Filter a workspace's list by label, and sort it by
  Recent / Priority / Due date.
- **Timetable** — a day-by-day time-blocked schedule (prev/today/tomorrow/
  next). Adding a block lets you either type a title or **pick from a
  dropdown of tasks** labeled Today / Tomorrow / Important, or due that
  day, across every workspace — picking one fills the block from that
  task. Each block also has its own **subtask checklist** scoped just to
  that block (e.g. an "Office 9–5" block can hold its own sub-items). Save
  any day's blocks as a reusable **template** and load it into another day.
- **Stats** — a pinned workspace: completion rate per workspace, every
  repeating task's current streak, how many tasks you've completed in the
  last 7 days, and how many of the last 7 days had a timetable planned.
- **Search** (🔍 icon) — one box that filters tasks (title + notes) and
  timetable blocks across every workspace at once; tapping a result jumps
  straight to it.
- **Settings** (gear icon) — light/dark/system theme, **optional
  cross-device sync** (see below), a best-effort plan-tomorrow reminder,
  and data tools: export a full JSON backup (downloads a file),
  import/restore from one, or clear everything.

## Cross-device sync (optional)

By default everything is local-only, same as before. If you want the same
data on your phone and your laptop, Settings → Sync across devices can
turn on real sync via Firebase (Auth + Firestore) — but that needs a free
Firebase project first, which is a step only you can do (like creating the
GitHub repo). Full walkthrough: **[`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md)**.
Until you set that up, the Settings screen just says so and the app
behaves exactly as it always has — no network calls to Firebase happen
until it's configured.

## Running it

No build step — it's static files.

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

Or just double-click `index.html` (some browsers restrict `fetch`/service
workers on the `file://` scheme, so a local server is more reliable,
especially for testing the installable/offline behavior).

To host it somewhere reachable from your phone (so you can actually add it
to your home screen), any static host works — GitHub Pages, Netlify,
Vercel, or even `python3 -m http.server` on your laptop while your phone is
on the same Wi-Fi.

## On the reminder

Browsers cannot guarantee notifications while a tab/PWA is fully closed —
there's no background OS scheduling like a native app gets. The reminder
here fires via the Notification API while the app is open (or briefly
after, depending on the browser). Treat it as a nice-to-have nudge, not a
guaranteed alarm; the in-app banner ("Tomorrow's timetable isn't planned
yet") is the more reliable signal since it just checks state whenever you
open the app.

## Data & privacy

Everything lives in this browser's `localStorage` for this origin, unless
you've set up sync (see above), in which case it also lives in your own
Firestore database, reachable only by your signed-in account. Nothing is
sent anywhere else. Export a backup from Settings periodically if you want
an extra safety net or want to move data to a device you haven't signed
in on.

## Files

```
web/
  index.html          # app shell
  styles.css          # theme (light/dark), layout, components
  app.js              # all state + rendering logic (ES module, no build)
  sync.js             # optional Firebase Auth + Firestore sync layer
  firebase-config.js  # your Firebase project's web config (placeholder by default)
  FIREBASE_SETUP.md   # how to enable sync
  manifest.json        # PWA manifest
  sw.js                # service worker (offline app-shell caching)
  icons/                # placeholder app icons (swap these for your own art)
```
