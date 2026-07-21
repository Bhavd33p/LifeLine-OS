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
- **Tasks** — live inside a workspace, each with a title, notes, and any
  number of **labels** (Important, Today, Tomorrow, Office, Personal by
  default). Filter a workspace's list by label.
- **Timetable** — a day-by-day time-blocked schedule (prev/today/tomorrow/
  next). Adding a block lets you either type a title or **pick from a
  dropdown of tasks labeled Today / Tomorrow / Important** across every
  workspace — picking one fills the block from that task. Each block also
  has its own **subtask checklist** scoped just to that block (e.g. an
  "Office 9–5" block can hold its own sub-items). Save any day's blocks as
  a reusable **template** and load it into another day.
- **Settings** (gear icon) — light/dark/system theme, a best-effort
  plan-tomorrow reminder, and data tools: export a full JSON backup
  (downloads a file), import/restore from one, or clear everything.

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

Everything lives in this browser's `localStorage` for this origin. Nothing
is sent anywhere. Clearing your browser's site data (or a different
browser/device) starts fresh — export a backup from Settings periodically
if you want a safety net or want to move data to another device (Export
there, Import here).

## Files

```
web/
  index.html      # app shell
  styles.css       # theme (light/dark), layout, components
  app.js           # all state + rendering logic (no framework, no build)
  manifest.json    # PWA manifest
  sw.js            # service worker (offline app-shell caching)
  icons/           # placeholder app icons (swap these for your own art)
```
