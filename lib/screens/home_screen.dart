import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../providers/calendar_provider.dart';
import '../providers/finance_provider.dart';
import '../providers/habits_provider.dart';
import '../providers/health_provider.dart';
import '../providers/tasks_provider.dart';
import '../utils/date_utils.dart';
import '../widgets/empty_state.dart';
import '../widgets/section_card.dart';

final _currency = NumberFormat.currency(symbol: '\$');

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = dateOnly(DateTime.now());
    final dueTasks = ref.watch(tasksDueTodayProvider);
    final habits = ref.watch(habitsProvider);
    final agenda = ref.watch(agendaForDayProvider(today));
    final summary = ref.watch(monthlySummaryProvider);
    final todayHealth = ref.watch(todayHealthEntryProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(DateFormat.yMMMEd().format(today)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Good day 👋', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Due today',
            child: dueTasks.isEmpty
                ? const EmptyState(icon: Icons.check_circle_outline, message: 'Nothing due today.')
                : Column(
                    children: dueTasks
                        .map((t) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Checkbox(
                                value: t.isDone,
                                onChanged: (_) => ref.read(tasksProvider.notifier).toggleDone(t.id),
                              ),
                              title: Text(t.title),
                            ))
                        .toList(),
                  ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Habits',
            child: habits.isEmpty
                ? const EmptyState(icon: Icons.repeat, message: 'No habits set up yet.')
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: habits.map((h) => _HabitChip(habitId: h.id, name: h.name)).toList(),
                  ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Today's schedule",
            child: agenda.isEmpty
                ? const EmptyState(icon: Icons.event_available, message: 'Nothing scheduled today.')
                : Column(
                    children: agenda.events
                        .map((e) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.event_note),
                              title: Text(e.title),
                              subtitle: e.hasTime
                                  ? Text(TimeOfDay(hour: e.hour!, minute: e.minute ?? 0).format(context))
                                  : null,
                            ))
                        .toList(),
                  ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'This month',
            child: Row(
              children: [
                Expanded(child: _MiniStat(label: 'Income', value: _currency.format(summary.income))),
                Expanded(child: _MiniStat(label: 'Expense', value: _currency.format(summary.expense))),
                Expanded(child: _MiniStat(label: 'Net', value: _currency.format(summary.net))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Health today',
            child: todayHealth == null
                ? const EmptyState(icon: Icons.favorite_border, message: "No check-in yet. Log it on the Health tab.")
                : Text(
                    [
                      if (todayHealth.sleepHours != null) '${todayHealth.sleepHours}h sleep',
                      if (todayHealth.waterLiters != null) '${todayHealth.waterLiters}L water',
                      if (todayHealth.workoutDone) 'Workout done',
                    ].join(' · '),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _HabitChip extends ConsumerWidget {
  final String habitId;
  final String name;

  const _HabitChip({required this.habitId, required this.name});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final done = ref.watch(isHabitDoneTodayProvider(habitId));
    return FilterChip(
      label: Text(name),
      selected: done,
      onSelected: (_) => ref.read(habitLogsProvider.notifier).toggleToday(habitId),
      avatar: done ? const Icon(Icons.check, size: 16) : null,
    );
  }
}
