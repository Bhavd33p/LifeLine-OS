import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/health_entry.dart';
import '../../providers/health_provider.dart';

const _moodEmojis = {1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄'};

class HealthEntryForm extends ConsumerStatefulWidget {
  const HealthEntryForm({super.key});

  @override
  ConsumerState<HealthEntryForm> createState() => _HealthEntryFormState();
}

class _HealthEntryFormState extends ConsumerState<HealthEntryForm> {
  final _sleepController = TextEditingController();
  final _waterController = TextEditingController();
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();
  int? _mood;
  bool _workoutDone = false;
  bool _hydrated = false;

  @override
  void dispose() {
    _sleepController.dispose();
    _waterController.dispose();
    _weightController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _hydrate(HealthEntry? entry) {
    if (_hydrated || entry == null) return;
    _hydrated = true;
    _sleepController.text = entry.sleepHours?.toString() ?? '';
    _waterController.text = entry.waterLiters?.toString() ?? '';
    _weightController.text = entry.weightKg?.toString() ?? '';
    _notesController.text = entry.notes ?? '';
    _mood = entry.mood;
    _workoutDone = entry.workoutDone;
  }

  void _save() {
    ref.read(healthEntriesProvider.notifier).saveToday(
          sleepHours: double.tryParse(_sleepController.text.trim()),
          waterLiters: double.tryParse(_waterController.text.trim()),
          weightKg: double.tryParse(_weightController.text.trim()),
          mood: _mood,
          workoutDone: _workoutDone,
          notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Today's check-in saved"), duration: Duration(seconds: 1)),
    );
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    _hydrate(ref.watch(todayHealthEntryProvider));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _sleepController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Sleep (hrs)'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _waterController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Water (L)'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _weightController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Weight (kg)'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilterChip(
                label: const Text('Workout done'),
                selected: _workoutDone,
                onSelected: (v) => setState(() => _workoutDone = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text('Mood', style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: _moodEmojis.entries.map((e) {
            final selected = _mood == e.key;
            return InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => setState(() => _mood = e.key),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: selected ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.15) : null,
                  shape: BoxShape.circle,
                ),
                child: Text(e.value, style: const TextStyle(fontSize: 22)),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _notesController,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Notes (optional)'),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton(onPressed: _save, child: const Text("Save today's check-in")),
        ),
      ],
    );
  }
}
