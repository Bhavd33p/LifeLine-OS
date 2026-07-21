enum HabitFrequency { daily, weekly }

HabitFrequency habitFrequencyFromName(String? name) => HabitFrequency.values.firstWhere(
      (f) => f.name == name,
      orElse: () => HabitFrequency.daily,
    );

class Habit {
  final String id;
  final String name;
  final String? notes;
  final HabitFrequency frequency;
  final DateTime createdAt;
  final bool archived;

  const Habit({
    required this.id,
    required this.name,
    this.notes,
    this.frequency = HabitFrequency.daily,
    required this.createdAt,
    this.archived = false,
  });

  Habit copyWith({
    String? name,
    String? notes,
    HabitFrequency? frequency,
    bool? archived,
  }) {
    return Habit(
      id: id,
      name: name ?? this.name,
      notes: notes ?? this.notes,
      frequency: frequency ?? this.frequency,
      createdAt: createdAt,
      archived: archived ?? this.archived,
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'notes': notes,
        'frequency': frequency.name,
        'createdAt': createdAt.toIso8601String(),
        'archived': archived,
      };

  factory Habit.fromMap(Map<dynamic, dynamic> map) => Habit(
        id: map['id'] as String,
        name: map['name'] as String,
        notes: map['notes'] as String?,
        frequency: habitFrequencyFromName(map['frequency'] as String?),
        createdAt: DateTime.parse(map['createdAt'] as String),
        archived: map['archived'] as bool? ?? false,
      );
}
