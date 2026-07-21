# Personal OS

A local-first phone app that tracks everything in one place: tasks, habits,
finances, health, and your calendar. Everything lives on-device — there is
no backend, no account, and no network calls.

## Features

- **Home dashboard** — today's tasks, habit check-offs, today's schedule,
  this month's money snapshot, and today's health check-in, all in one view.
- **Tasks & Habits** — to-dos with due dates and priority; recurring habits
  with daily check-offs and streak tracking.
- **Finance** — log income/expenses by category, see this month's totals
  and a per-category breakdown.
- **Health** — daily check-in for sleep, water, weight, mood, and workouts,
  plus a 7-day trend view.
- **Calendar** — a month view that merges your own events with task due
  dates, so you can see everything scheduled on a given day.

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
  an `IndexedStack` of the five tabs — no router package needed for an app
  this size.

```
lib/
  models/       # plain Dart data classes (toMap/fromMap, no codegen)
  services/     # StorageService — Hive init + box access
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

## Notes on data & privacy

All data is stored locally in Hive boxes under the app's documents
directory. Nothing is synced or uploaded. Uninstalling the app deletes the
data; there is currently no export/import or backup feature.
