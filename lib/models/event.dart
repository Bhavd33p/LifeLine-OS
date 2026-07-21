class CalendarEvent {
  final String id;
  final String title;
  final DateTime date;
  final int? hour;
  final int? minute;
  final String? notes;

  const CalendarEvent({
    required this.id,
    required this.title,
    required this.date,
    this.hour,
    this.minute,
    this.notes,
  });

  bool get hasTime => hour != null;

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'date': date.toIso8601String(),
        'hour': hour,
        'minute': minute,
        'notes': notes,
      };

  factory CalendarEvent.fromMap(Map<dynamic, dynamic> map) => CalendarEvent(
        id: map['id'] as String,
        title: map['title'] as String,
        date: DateTime.parse(map['date'] as String),
        hour: map['hour'] as int?,
        minute: map['minute'] as int?,
        notes: map['notes'] as String?,
      );
}
