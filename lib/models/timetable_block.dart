import 'work_category.dart';

/// A single time-blocked slot on a specific day's timetable.
class TimetableBlock {
  final String id;
  final DateTime date;
  final String title;
  final int startHour;
  final int startMinute;
  final int endHour;
  final int endMinute;
  final WorkCategory category;
  final String? notes;

  const TimetableBlock({
    required this.id,
    required this.date,
    required this.title,
    required this.startHour,
    required this.startMinute,
    required this.endHour,
    required this.endMinute,
    this.category = WorkCategory.other,
    this.notes,
  });

  int get startMinutesOfDay => startHour * 60 + startMinute;
  int get endMinutesOfDay => endHour * 60 + endMinute;

  Map<String, dynamic> toMap() => {
        'id': id,
        'date': date.toIso8601String(),
        'title': title,
        'startHour': startHour,
        'startMinute': startMinute,
        'endHour': endHour,
        'endMinute': endMinute,
        'category': category.name,
        'notes': notes,
      };

  factory TimetableBlock.fromMap(Map<dynamic, dynamic> map) => TimetableBlock(
        id: map['id'] as String,
        date: DateTime.parse(map['date'] as String),
        title: map['title'] as String,
        startHour: map['startHour'] as int,
        startMinute: map['startMinute'] as int,
        endHour: map['endHour'] as int,
        endMinute: map['endMinute'] as int,
        category: workCategoryFromName(map['category'] as String?),
        notes: map['notes'] as String?,
      );
}
