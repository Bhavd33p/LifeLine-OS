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
  on-device notification at a time you set (`SettingsNotifier` persists it
  in a small Hive `settings` box). Purely local — no push service, no
  account.

```
lib/
  models/       # plain Dart data classes (toMap/fromMap, no codegen)
  services/     # StorageService (Hive) + NotificationService
  providers/    # Riverpod StateNotifiers + derived providers per domain
  screens/      # one folder per tab, plus shared home_screen.dart
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
directory. Nothing is synced or uploaded. Uninstalling the app deletes the
data; there is currently no export/import or backup feature.
