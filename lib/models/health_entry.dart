/// One health check-in per calendar day.
class HealthEntry {
  final String id;
  final DateTime date;
  final double? sleepHours;
  final double? waterLiters;
  final double? weightKg;
  final int? mood; // 1 (low) .. 5 (great)
  final bool workoutDone;
  final String? notes;

  const HealthEntry({
    required this.id,
    required this.date,
    this.sleepHours,
    this.waterLiters,
    this.weightKg,
    this.mood,
    this.workoutDone = false,
    this.notes,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'date': date.toIso8601String(),
        'sleepHours': sleepHours,
        'waterLiters': waterLiters,
        'weightKg': weightKg,
        'mood': mood,
        'workoutDone': workoutDone,
        'notes': notes,
      };

  factory HealthEntry.fromMap(Map<dynamic, dynamic> map) => HealthEntry(
        id: map['id'] as String,
        date: DateTime.parse(map['date'] as String),
        sleepHours: (map['sleepHours'] as num?)?.toDouble(),
        waterLiters: (map['waterLiters'] as num?)?.toDouble(),
        weightKg: (map['weightKg'] as num?)?.toDouble(),
        mood: map['mood'] as int?,
        workoutDone: map['workoutDone'] as bool? ?? false,
        notes: map['notes'] as String?,
      );
}
