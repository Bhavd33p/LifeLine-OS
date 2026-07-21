import '../utils/date_utils.dart';

/// One completion record for a habit on a given day.
/// The id is deterministic (`habitId_yyyy-MM-dd`) so completing the same
/// habit on the same day twice overwrites rather than duplicates.
class HabitLog {
  final String id;
  final String habitId;
  final DateTime date;

  const HabitLog({
    required this.id,
    required this.habitId,
    required this.date,
  });

  static String idFor(String habitId, DateTime date) {
    final d = dateOnly(date);
    return '${habitId}_${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
  }

  factory HabitLog.forCompletion(String habitId, DateTime date) {
    final d = dateOnly(date);
    return HabitLog(id: idFor(habitId, d), habitId: habitId, date: d);
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'habitId': habitId,
        'date': date.toIso8601String(),
      };

  factory HabitLog.fromMap(Map<dynamic, dynamic> map) => HabitLog(
        id: map['id'] as String,
        habitId: map['habitId'] as String,
        date: DateTime.parse(map['date'] as String),
      );
}
