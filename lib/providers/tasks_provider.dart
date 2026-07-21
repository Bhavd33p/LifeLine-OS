import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/task.dart';
import '../models/work_category.dart';
import '../services/storage_service.dart';
import '../utils/date_utils.dart';

const _uuid = Uuid();

class TasksNotifier extends StateNotifier<List<TaskItem>> {
  TasksNotifier() : super(_loadAll());

  static List<TaskItem> _loadAll() {
    final items = StorageService.tasksBox.values.map(TaskItem.fromMap).toList();
    items.sort((a, b) {
      if (a.isDone != b.isDone) return a.isDone ? 1 : -1;
      if (a.dueDate == null && b.dueDate == null) {
        return b.createdAt.compareTo(a.createdAt);
      }
      if (a.dueDate == null) return 1;
      if (b.dueDate == null) return -1;
      return a.dueDate!.compareTo(b.dueDate!);
    });
    return items;
  }

  Future<void> addTask({
    required String title,
    String? notes,
    DateTime? dueDate,
    TaskPriority priority = TaskPriority.medium,
    WorkCategory category = WorkCategory.other,
  }) async {
    final task = TaskItem(
      id: _uuid.v4(),
      title: title,
      notes: notes,
      dueDate: dueDate,
      priority: priority,
      category: category,
      createdAt: DateTime.now(),
    );
    await StorageService.tasksBox.put(task.id, task.toMap());
    state = _loadAll();
  }

  Future<void> updateTask(TaskItem task) async {
    await StorageService.tasksBox.put(task.id, task.toMap());
    state = _loadAll();
  }

  Future<void> toggleDone(String id) async {
    final map = StorageService.tasksBox.get(id);
    if (map == null) return;
    final task = TaskItem.fromMap(map);
    await StorageService.tasksBox.put(id, task.copyWith(isDone: !task.isDone).toMap());
    state = _loadAll();
  }

  Future<void> deleteTask(String id) async {
    await StorageService.tasksBox.delete(id);
    state = _loadAll();
  }

  /// Re-reads the box from disk — used after a backup restore or data wipe.
  void reload() => state = _loadAll();
}

final tasksProvider = StateNotifierProvider<TasksNotifier, List<TaskItem>>(
  (ref) => TasksNotifier(),
);

/// Tasks due today or earlier (and not yet done), for the home dashboard.
final tasksDueTodayProvider = Provider<List<TaskItem>>((ref) {
  final tasks = ref.watch(tasksProvider);
  final today = dateOnly(DateTime.now());
  return tasks
      .where((t) => !t.isDone && t.dueDate != null && !dateOnly(t.dueDate!).isAfter(today))
      .toList();
});
