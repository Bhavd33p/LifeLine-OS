import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/habit.dart';
import '../../models/task.dart';
import '../../providers/habits_provider.dart';
import '../../providers/tasks_provider.dart';
import '../../widgets/empty_state.dart';
import 'habit_form_sheet.dart';
import 'task_form_sheet.dart';

class TasksHabitsScreen extends ConsumerStatefulWidget {
  const TasksHabitsScreen({super.key});

  @override
  ConsumerState<TasksHabitsScreen> createState() => _TasksHabitsScreenState();
}

class _TasksHabitsScreenState extends ConsumerState<TasksHabitsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasks & Habits'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [Tab(text: 'Tasks'), Tab(text: 'Habits')],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [_TaskList(), _HabitList()],
      ),
      floatingActionButton: AnimatedBuilder(
        animation: _tabController,
        builder: (context, _) {
          return FloatingActionButton(
            onPressed: () {
              if (_tabController.index == 0) {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => const TaskFormSheet(),
                );
              } else {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => const HabitFormSheet(),
                );
              }
            },
            child: const Icon(Icons.add),
          );
        },
      ),
    );
  }
}

Color _priorityColor(TaskPriority priority) {
  switch (priority) {
    case TaskPriority.high:
      return Colors.redAccent;
    case TaskPriority.medium:
      return Colors.orangeAccent;
    case TaskPriority.low:
      return Colors.blueGrey;
  }
}

class _TaskList extends ConsumerWidget {
  const _TaskList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(tasksProvider);
    if (tasks.isEmpty) {
      return const EmptyState(
        icon: Icons.check_circle_outline,
        message: 'No tasks yet.\nTap + to add one.',
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: tasks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) => _TaskTile(task: tasks[index]),
    );
  }
}

class _TaskTile extends ConsumerWidget {
  final TaskItem task;

  const _TaskTile({required this.task});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Dismissible(
      key: ValueKey(task.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(color: Colors.red.shade400, borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => ref.read(tasksProvider.notifier).deleteTask(task.id),
      child: Card(
        child: ListTile(
          leading: Checkbox(
            value: task.isDone,
            onChanged: (_) => ref.read(tasksProvider.notifier).toggleDone(task.id),
          ),
          title: Text(
            task.title,
            style: TextStyle(decoration: task.isDone ? TextDecoration.lineThrough : null),
          ),
          subtitle: task.dueDate != null
              ? Text('Due ${DateFormat.yMMMd().format(task.dueDate!)}')
              : (task.notes != null ? Text(task.notes!) : null),
          trailing: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: _priorityColor(task.priority), shape: BoxShape.circle),
          ),
        ),
      ),
    );
  }
}

class _HabitList extends ConsumerWidget {
  const _HabitList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final habits = ref.watch(habitsProvider);
    if (habits.isEmpty) {
      return const EmptyState(
        icon: Icons.repeat,
        message: 'No habits yet.\nTap + to start one.',
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: habits.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) => _HabitTile(habit: habits[index]),
    );
  }
}

class _HabitTile extends ConsumerWidget {
  final Habit habit;

  const _HabitTile({required this.habit});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doneToday = ref.watch(isHabitDoneTodayProvider(habit.id));
    final streak = ref.watch(habitStreakProvider(habit.id));
    return Dismissible(
      key: ValueKey(habit.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(color: Colors.red.shade400, borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => ref.read(habitsProvider.notifier).deleteHabit(habit.id),
      child: Card(
        child: ListTile(
          leading: IconButton(
            icon: Icon(
              doneToday ? Icons.check_circle : Icons.check_circle_outline,
              color: doneToday ? Colors.green : null,
            ),
            onPressed: () => ref.read(habitLogsProvider.notifier).toggleToday(habit.id),
          ),
          title: Text(habit.name),
          subtitle: Text(habit.frequency == HabitFrequency.daily ? 'Daily' : 'Weekly'),
          trailing: streak > 0
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.local_fire_department, color: Colors.deepOrange, size: 18),
                    const SizedBox(width: 2),
                    Text('$streak'),
                  ],
                )
              : null,
        ),
      ),
    );
  }
}
