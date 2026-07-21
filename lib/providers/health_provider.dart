import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/health_entry.dart';
import '../services/storage_service.dart';
import '../utils/date_utils.dart';

const _uuid = Uuid();

class HealthNotifier extends StateNotifier<List<HealthEntry>> {
  HealthNotifier() : super(_loadAll());

  static List<HealthEntry> _loadAll() {
    final items = StorageService.healthBox.values.map(HealthEntry.fromMap).toList();
    items.sort((a, b) => b.date.compareTo(a.date));
    return items;
  }

  /// Creates or overwrites today's entry (one entry per day).
  Future<void> saveToday({
    double? sleepHours,
    double? waterLiters,
    double? weightKg,
    int? mood,
    bool workoutDone = false,
    String? notes,
  }) async {
    final today = dateOnly(DateTime.now());
    final existing = _loadAll().where((e) => isSameDay(e.date, today)).toList();
    final id = existing.isNotEmpty ? existing.first.id : _uuid.v4();
    final entry = HealthEntry(
      id: id,
      date: today,
      sleepHours: sleepHours,
      waterLiters: waterLiters,
      weightKg: weightKg,
      mood: mood,
      workoutDone: workoutDone,
      notes: notes,
    );
    await StorageService.healthBox.put(entry.id, entry.toMap());
    state = _loadAll();
  }

  Future<void> deleteEntry(String id) async {
    await StorageService.healthBox.delete(id);
    state = _loadAll();
  }
}

final healthEntriesProvider = StateNotifierProvider<HealthNotifier, List<HealthEntry>>(
  (ref) => HealthNotifier(),
);

final todayHealthEntryProvider = Provider<HealthEntry?>((ref) {
  final entries = ref.watch(healthEntriesProvider);
  final today = dateOnly(DateTime.now());
  for (final e in entries) {
    if (isSameDay(e.date, today)) return e;
  }
  return null;
});

/// Last 7 days of entries, oldest first.
final weeklyHealthEntriesProvider = Provider<List<HealthEntry>>((ref) {
  final entries = ref.watch(healthEntriesProvider);
  final cutoff = dateOnly(DateTime.now()).subtract(const Duration(days: 6));
  return entries.where((e) => !dateOnly(e.date).isBefore(cutoff)).toList()
    ..sort((a, b) => a.date.compareTo(b.date));
});
