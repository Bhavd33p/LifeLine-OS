import 'work_category.dart';

/// A reusable block in the saved daily template — same shape as
/// [TimetableBlock] but with no date, since it's applied to any day.
class TemplateBlock {
  final String id;
  final String title;
  final int startHour;
  final int startMinute;
  final int endHour;
  final int endMinute;
  final WorkCategory category;
  final String? notes;

  const TemplateBlock({
    required this.id,
    required this.title,
    required this.startHour,
    required this.startMinute,
    required this.endHour,
    required this.endMinute,
    this.category = WorkCategory.other,
    this.notes,
  });

  int get startMinutesOfDay => startHour * 60 + startMinute;

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'startHour': startHour,
        'startMinute': startMinute,
        'endHour': endHour,
        'endMinute': endMinute,
        'category': category.name,
        'notes': notes,
      };

  factory TemplateBlock.fromMap(Map<dynamic, dynamic> map) => TemplateBlock(
        id: map['id'] as String,
        title: map['title'] as String,
        startHour: map['startHour'] as int,
        startMinute: map['startMinute'] as int,
        endHour: map['endHour'] as int,
        endMinute: map['endMinute'] as int,
        category: workCategoryFromName(map['category'] as String?),
        notes: map['notes'] as String?,
      );
}
