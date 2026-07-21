import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/health_entry.dart';
import '../../providers/health_provider.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/section_card.dart';
import 'health_entry_form.dart';

class HealthScreen extends ConsumerWidget {
  const HealthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final weekly = ref.watch(weeklyHealthEntriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Health')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SectionCard(title: "Today's check-in", child: HealthEntryForm()),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Last 7 days',
            child: weekly.isEmpty
                ? const EmptyState(icon: Icons.favorite_border, message: 'No check-ins logged yet.')
                : Column(children: weekly.reversed.map((e) => _HealthRow(entry: e)).toList()),
          ),
        ],
      ),
    );
  }
}

class _HealthRow extends StatelessWidget {
  final HealthEntry entry;

  const _HealthRow({required this.entry});

  @override
  Widget build(BuildContext context) {
    final parts = <String>[];
    if (entry.sleepHours != null) parts.add('${entry.sleepHours}h sleep');
    if (entry.waterLiters != null) parts.add('${entry.waterLiters}L water');
    if (entry.weightKg != null) parts.add('${entry.weightKg}kg');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            child: Text(DateFormat.MMMd().format(entry.date), style: Theme.of(context).textTheme.bodySmall),
          ),
          if (entry.workoutDone) const Icon(Icons.fitness_center, size: 16, color: Colors.deepOrange),
          if (entry.workoutDone) const SizedBox(width: 6),
          Expanded(
            child: Text(
              parts.isEmpty ? 'No metrics logged' : parts.join(' · '),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}
