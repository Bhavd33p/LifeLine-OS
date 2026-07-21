import 'work_category.dart';

enum TaskPriority { low, medium, high }

TaskPriority taskPriorityFromName(String? name) => TaskPriority.values.firstWhere(
      (p) => p.name == name,
      orElse: () => TaskPriority.medium,
    );

class TaskItem {
  final String id;
  final String title;
  final String? notes;
  final DateTime? dueDate;
  final TaskPriority priority;
  final WorkCategory category;
  final bool isDone;
  final DateTime createdAt;

  const TaskItem({
    required this.id,
    required this.title,
    this.notes,
    this.dueDate,
    this.priority = TaskPriority.medium,
    this.category = WorkCategory.other,
    this.isDone = false,
    required this.createdAt,
  });

  TaskItem copyWith({
    String? title,
    String? notes,
    DateTime? dueDate,
    bool clearDueDate = false,
    TaskPriority? priority,
    WorkCategory? category,
    bool? isDone,
  }) {
    return TaskItem(
      id: id,
      title: title ?? this.title,
      notes: notes ?? this.notes,
      dueDate: clearDueDate ? null : (dueDate ?? this.dueDate),
      priority: priority ?? this.priority,
      category: category ?? this.category,
      isDone: isDone ?? this.isDone,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'notes': notes,
        'dueDate': dueDate?.toIso8601String(),
        'priority': priority.name,
        'category': category.name,
        'isDone': isDone,
        'createdAt': createdAt.toIso8601String(),
      };

  factory TaskItem.fromMap(Map<dynamic, dynamic> map) => TaskItem(
        id: map['id'] as String,
        title: map['title'] as String,
        notes: map['notes'] as String?,
        dueDate:
            map['dueDate'] != null ? DateTime.parse(map['dueDate'] as String) : null,
        priority: taskPriorityFromName(map['priority'] as String?),
        category: workCategoryFromName(map['category'] as String?),
        isDone: map['isDone'] as bool? ?? false,
        createdAt: DateTime.parse(map['createdAt'] as String),
      );
}
