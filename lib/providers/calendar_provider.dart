import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/event.dart';
import '../services/storage_service.dart';
import '../utils/date_utils.dart';
import 'tasks_provider.dart';

const _uuid = Uuid();

class EventsNotifier extends StateNotifier<List<CalendarEvent>> {
  EventsNotifier() : super(_loadAll());

  static List<CalendarEvent> _loadAll() {
    final items = StorageService.eventsBox.values.map(CalendarEvent.fromMap).toList();
    items.sort((a, b) => a.date.compareTo(b.date));
    return items;
  }

  Future<void> addEvent({
    required String title,
    required DateTime date,
    int? hour,
    int? minute,
    String? notes,
  }) async {
    final event = CalendarEvent(
      id: _uuid.v4(),
      title: title,
      date: dateOnly(date),
      hour: hour,
      minute: minute,
      notes: notes,
    );
    await StorageService.eventsBox.put(event.id, event.toMap());
    state = _loadAll();
  }

  Future<void> deleteEvent(String id) async {
    await StorageService.eventsBox.delete(id);
    state = _loadAll();
  }
}

final eventsProvider = StateNotifierProvider<EventsNotifier, List<CalendarEvent>>(
  (ref) => EventsNotifier(),
);

/// Every day in the given month that has an event or a task due, for
/// drawing dots on the month grid.
final markedDaysInMonthProvider = Provider.family<Set<DateTime>, DateTime>((ref, month) {
  final events = ref.watch(eventsProvider);
  final tasks = ref.watch(tasksProvider);
  final marked = <DateTime>{};
  for (final e in events) {
    if (e.date.year == month.year && e.date.month == month.month) {
      marked.add(dateOnly(e.date));
    }
  }
  for (final t in tasks) {
    final due = t.dueDate;
    if (due != null && due.year == month.year && due.month == month.month) {
      marked.add(dateOnly(due));
    }
  }
  return marked;
});

class DayAgenda {
  final List<CalendarEvent> events;
  final List<String> taskTitlesDue;

  const DayAgenda({required this.events, required this.taskTitlesDue});

  bool get isEmpty => events.isEmpty && taskTitlesDue.isEmpty;
}

final agendaForDayProvider = Provider.family<DayAgenda, DateTime>((ref, day) {
  final target = dateOnly(day);
  final events = ref
      .watch(eventsProvider)
      .where((e) => isSameDay(e.date, target))
      .toList()
    ..sort((a, b) => (a.hour ?? -1).compareTo(b.hour ?? -1));
  final taskTitles = ref
      .watch(tasksProvider)
      .where((t) => t.dueDate != null && isSameDay(t.dueDate!, target))
      .map((t) => t.title)
      .toList();
  return DayAgenda(events: events, taskTitlesDue: taskTitles);
});
