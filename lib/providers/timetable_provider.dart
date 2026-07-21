import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/template_block.dart';
import '../models/timetable_block.dart';
import '../models/work_category.dart';
import '../services/storage_service.dart';
import '../utils/date_utils.dart';

const _uuid = Uuid();

class TimetableNotifier extends StateNotifier<List<TimetableBlock>> {
  TimetableNotifier() : super(_loadAll());

  static List<TimetableBlock> _loadAll() {
    final items = StorageService.timetableBox.values.map(TimetableBlock.fromMap).toList();
    items.sort((a, b) {
      final dateCompare = a.date.compareTo(b.date);
      if (dateCompare != 0) return dateCompare;
      return a.startMinutesOfDay.compareTo(b.startMinutesOfDay);
    });
    return items;
  }

  Future<void> addBlock({
    required DateTime date,
    required String title,
    required int startHour,
    required int startMinute,
    required int endHour,
    required int endMinute,
    WorkCategory category = WorkCategory.other,
    String? notes,
  }) async {
    final block = TimetableBlock(
      id: _uuid.v4(),
      date: dateOnly(date),
      title: title,
      startHour: startHour,
      startMinute: startMinute,
      endHour: endHour,
      endMinute: endMinute,
      category: category,
      notes: notes,
    );
    await StorageService.timetableBox.put(block.id, block.toMap());
    state = _loadAll();
  }

  Future<void> deleteBlock(String id) async {
    await StorageService.timetableBox.delete(id);
    state = _loadAll();
  }

  /// Removes every block on [date]. Used before applying a template so the
  /// day starts clean instead of stacking template blocks on old ones.
  Future<void> clearDay(DateTime date) async {
    final target = dateOnly(date);
    final box = StorageService.timetableBox;
    final staleKeys = box.values
        .map(TimetableBlock.fromMap)
        .where((b) => isSameDay(b.date, target))
        .map((b) => b.id)
        .toList();
    await box.deleteAll(staleKeys);
    state = _loadAll();
  }

  Future<void> applyTemplate(DateTime date, List<TemplateBlock> template) async {
    await clearDay(date);
    final box = StorageService.timetableBox;
    for (final t in template) {
      final block = TimetableBlock(
        id: _uuid.v4(),
        date: dateOnly(date),
        title: t.title,
        startHour: t.startHour,
        startMinute: t.startMinute,
        endHour: t.endHour,
        endMinute: t.endMinute,
        category: t.category,
        notes: t.notes,
      );
      await box.put(block.id, block.toMap());
    }
    state = _loadAll();
  }
}

final timetableProvider = StateNotifierProvider<TimetableNotifier, List<TimetableBlock>>(
  (ref) => TimetableNotifier(),
);

final blocksForDayProvider = Provider.family<List<TimetableBlock>, DateTime>((ref, day) {
  final target = dateOnly(day);
  return ref.watch(timetableProvider).where((b) => isSameDay(b.date, target)).toList();
});

/// Whether a day already has at least one planned block — used to nudge
/// the user in-app if tomorrow is still empty.
final dayIsPlannedProvider = Provider.family<bool, DateTime>((ref, day) {
  return ref.watch(blocksForDayProvider(day)).isNotEmpty;
});

class TemplateNotifier extends StateNotifier<List<TemplateBlock>> {
  TemplateNotifier() : super(_loadAll());

  static List<TemplateBlock> _loadAll() {
    final items = StorageService.templateBox.values.map(TemplateBlock.fromMap).toList();
    items.sort((a, b) => a.startMinutesOfDay.compareTo(b.startMinutesOfDay));
    return items;
  }

  /// Overwrites the saved template with the blocks currently on [date].
  Future<void> saveFromDay(DateTime date, List<TimetableBlock> dayBlocks) async {
    final box = StorageService.templateBox;
    await box.clear();
    for (final b in dayBlocks) {
      final t = TemplateBlock(
        id: _uuid.v4(),
        title: b.title,
        startHour: b.startHour,
        startMinute: b.startMinute,
        endHour: b.endHour,
        endMinute: b.endMinute,
        category: b.category,
        notes: b.notes,
      );
      await box.put(t.id, t.toMap());
    }
    state = _loadAll();
  }
}

final templateProvider = StateNotifierProvider<TemplateNotifier, List<TemplateBlock>>(
  (ref) => TemplateNotifier(),
);
