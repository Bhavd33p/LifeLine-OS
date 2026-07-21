import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/habit.dart';
import '../models/habit_log.dart';
import '../services/storage_service.dart';
import '../utils/date_utils.dart';

const _uuid = Uuid();

class HabitsNotifier extends StateNotifier<List<Habit>> {
  HabitsNotifier() : super(_loadAll());

  static List<Habit> _loadAll() {
    final items = StorageService.habitsBox.values.map(Habit.fromMap).toList();
    items.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return items.where((h) => !h.archived).toList();
  }

  Future<void> addHabit({
    required String name,
    String? notes,
    HabitFrequency frequency = HabitFrequency.daily,
  }) async {
    final habit = Habit(
      id: _uuid.v4(),
      name: name,
      notes: notes,
      frequency: frequency,
      createdAt: DateTime.now(),
    );
    await StorageService.habitsBox.put(habit.id, habit.toMap());
    state = _loadAll();
  }

  Future<void> archiveHabit(String id) async {
    final map = StorageService.habitsBox.get(id);
    if (map == null) return;
    final habit = Habit.fromMap(map);
    await StorageService.habitsBox.put(id, habit.copyWith(archived: true).toMap());
    state = _loadAll();
  }

  Future<void> deleteHabit(String id) async {
    await StorageService.habitsBox.delete(id);
    final logsBox = StorageService.habitLogsBox;
    final staleKeys = logsBox.values
        .map(HabitLog.fromMap)
        .where((l) => l.habitId == id)
        .map((l) => l.id)
        .toList();
    await logsBox.deleteAll(staleKeys);
    state = _loadAll();
  }
}

final habitsProvider = StateNotifierProvider<HabitsNotifier, List<Habit>>(
  (ref) => HabitsNotifier(),
);

class HabitLogsNotifier extends StateNotifier<List<HabitLog>> {
  HabitLogsNotifier() : super(_loadAll());

  static List<HabitLog> _loadAll() =>
      StorageService.habitLogsBox.values.map(HabitLog.fromMap).toList();

  Future<void> toggleToday(String habitId) async {
    final today = dateOnly(DateTime.now());
    final id = HabitLog.idFor(habitId, today);
    final box = StorageService.habitLogsBox;
    if (box.containsKey(id)) {
      await box.delete(id);
    } else {
      final log = HabitLog.forCompletion(habitId, today);
      await box.put(log.id, log.toMap());
    }
    state = _loadAll();
  }
}

final habitLogsProvider = StateNotifierProvider<HabitLogsNotifier, List<HabitLog>>(
  (ref) => HabitLogsNotifier(),
);

final isHabitDoneTodayProvider = Provider.family<bool, String>((ref, habitId) {
  final logs = ref.watch(habitLogsProvider);
  final today = dateOnly(DateTime.now());
  return logs.any((l) => l.habitId == habitId && isSameDay(l.date, today));
});

/// Number of consecutive days (ending today or yesterday) the habit was logged.
final habitStreakProvider = Provider.family<int, String>((ref, habitId) {
  final logs = ref
      .watch(habitLogsProvider)
      .where((l) => l.habitId == habitId)
      .map((l) => dateOnly(l.date))
      .toSet();
  if (logs.isEmpty) return 0;

  var cursor = dateOnly(DateTime.now());
  if (!logs.contains(cursor)) {
    cursor = cursor.subtract(const Duration(days: 1));
    if (!logs.contains(cursor)) return 0;
  }

  var streak = 0;
  while (logs.contains(cursor)) {
    streak++;
    cursor = cursor.subtract(const Duration(days: 1));
  }
  return streak;
});
