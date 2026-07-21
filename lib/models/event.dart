import 'work_category.dart';

class CalendarEvent {
  final String id;
  final String title;
  final DateTime date;
  final int? hour;
  final int? minute;
  final String? notes;
  final WorkCategory category;

  const CalendarEvent({
    required this.id,
    required this.title,
    required this.date,
    this.hour,
    this.minute,
    this.notes,
    this.category = WorkCategory.other,
  });

  bool get hasTime => hour != null;

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'date': date.toIso8601String(),
        'hour': hour,
        'minute': minute,
        'notes': notes,
        'category': category.name,
      };

  factory CalendarEvent.fromMap(Map<dynamic, dynamic> map) => CalendarEvent(
        id: map['id'] as String,
        title: map['title'] as String,
        date: DateTime.parse(map['date'] as String),
        hour: map['hour'] as int?,
        minute: map['minute'] as int?,
        notes: map['notes'] as String?,
        category: workCategoryFromName(map['category'] as String?),
      );
}
