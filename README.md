# Personal OS

A local-first phone app that tracks everything in one place: tasks, habits,
finances, health, and your calendar. Everything lives on-device — there is
no backend, no account, and no network calls.

## Features

- **Home dashboard** — today's tasks, habit check-offs, today's schedule,
  this month's money snapshot, today's health check-in, and a nudge if
  tomorrow's timetable isn't planned yet, all in one view.
- **Tasks & Habits** — to-dos with due dates, priority, and an Office/
  Personal tag; recurring habits with daily check-offs and streak tracking.
- **Timetable** — build a time-blocked plan for a day (defaults to
  tomorrow) with Office/Personal-tagged blocks. Save any day as a reusable
  template and load it into a new day instead of starting from scratch.
  A daily local notification (default 8:00 PM, configurable) reminds you
  to plan tomorrow — no server involved, it's scheduled entirely on-device.
- **Finance** — log income/expenses by category, see this month's totals
  and a per-category breakdown.
- **Health** — daily check-in for sleep, water, weight, mood, and workouts,
  plus a 7-day trend view.
- **Calendar** — a month view that merges your own events (also
  Office/Personal-tagged) with task due dates, so you can see everything
  scheduled on a given day.
- **Editing** — tasks, habits, events, and timetable blocks can all be
  tapped to edit in place, not just added/deleted.
- **Settings** (gear icon on Home) — light/dark/system theme, a finance
  currency symbol, the plan-tomorrow reminder controls, and data tools:
  export a full JSON backup (via the share sheet), import/restore from a
  backup file, and a clear-all-data wipe. All local — export just hands you
  a file, nothing is uploaded anywhere.

## Architecture

- **Storage**: [Hive](https://pub.dev/packages/hive) — a fast, pure-Dart,
  on-device key/value store. Each domain (tasks, habits, habit logs,
  transactions, health entries, events) has its own box; records are stored
  as plain maps (`toMap()` / `fromMap()` on each model), so there's no
  code-generation step to run.
- **State**: [Riverpod](https://pub.dev/packages/flutter_riverpod) —
  `StateNotifierProvider`s wrap each Hive box and expose in-memory lists;
  derived `Provider`s compute things like today's due tasks, habit streaks,
  monthly totals, and a day's calendar agenda.
- **Navigation**: a single `Scaffold` with a Material 3 `NavigationBar` and
  an `IndexedStack` of the six tabs — no router package needed for an app
  this size.
- **Reminders**: [flutter_local_notifications](https://pub.dev/packages/flutter_local_notifications)
  + [timezone](https://pub.dev/packages/timezone) schedule a repeating
  on-device notification at a time you set. Purely local — no push
  service, no account.
- **Settings**: a single `AppSettings` (`SettingsNotifier`) persisted in a
  small Hive `settings` box — theme mode, currency symbol, and reminder
  enabled/hour/minute all live there.
- **Backup**: `BackupService` serializes every Hive box to one JSON file
  (`share_plus` hands it to the OS share sheet) and can restore/wipe from
  the Settings screen; each domain's `StateNotifier` exposes a `reload()`
  used after a restore so the UI picks up the new data immediately.

```
lib/
  models/       # plain Dart data classes (toMap/fromMap, no codegen)
  services/     # StorageService (Hive), NotificationService, BackupService
  providers/    # Riverpod StateNotifiers + derived providers per domain
  screens/      # one folder per tab, plus shared home_screen.dart + settings/
  widgets/      # small shared UI pieces (SectionCard, StatTile, ...)
  utils/        # date helpers
```

## Getting started

This repo ships only the Dart source (`lib/`, `pubspec.yaml`) — the
platform folders (`android/`, `ios/`, etc.) aren't checked in. Generate
them locally and run:

```bash
flutter create .        # adds android/ ios/ etc. around the existing lib/
flutter pub get
flutter run
```

Requires Flutter 3.3+ (Dart 3.3+).

### Android notification permission

For the plan-tomorrow reminder to show on Android 13+, add this to the
generated `android/app/src/main/AndroidManifest.xml` after running
`flutter create .`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

The app requests the runtime permission automatically on first launch;
this manifest entry is required alongside it. No extra setup is needed on
iOS — the permission prompt is requested at startup.

## Notes on data & privacy

All data is stored locally in Hive boxes under the app's documents
directory. Nothing is synced or uploaded automatically — the only way data
leaves the device is if you explicitly export a backup and choose to share
it somewhere (email, Drive, Files, etc.) via Settings → Export backup.
Uninstalling the app deletes the data, so exporting a backup periodically
is the only safety net.

## Known scope cuts

- Transactions can be deleted and re-added, but not edited in place
  (everything else — tasks, habits, events, timetable blocks — can be).
- No onboarding flow or app icon yet.
