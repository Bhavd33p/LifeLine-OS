import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/habit.dart';
import '../../providers/habits_provider.dart';
import '../../widgets/app_text_field.dart';

class HabitFormSheet extends ConsumerStatefulWidget {
  final Habit? existing;

  const HabitFormSheet({super.key, this.existing});

  @override
  ConsumerState<HabitFormSheet> createState() => _HabitFormSheetState();
}

class _HabitFormSheetState extends ConsumerState<HabitFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _nameController = TextEditingController(text: widget.existing?.name ?? '');
  late final _notesController = TextEditingController(text: widget.existing?.notes ?? '');
  late HabitFrequency _frequency = widget.existing?.frequency ?? HabitFrequency.daily;

  bool get _isEditing => widget.existing != null;

  @override
  void dispose() {
    _nameController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final name = _nameController.text.trim();
    final notes = _notesController.text.trim().isEmpty ? null : _notesController.text.trim();
    if (_isEditing) {
      ref.read(habitsProvider.notifier).updateHabit(
            widget.existing!.copyWith(name: name, notes: notes, frequency: _frequency),
          );
    } else {
      ref.read(habitsProvider.notifier).addHabit(name: name, notes: notes, frequency: _frequency);
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_isEditing ? 'Edit habit' : 'New habit', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            AppTextField(
              controller: _nameController,
              label: 'Habit name',
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
            ),
            const SizedBox(height: 12),
            AppTextField(controller: _notesController, label: 'Notes (optional)', maxLines: 2),
            const SizedBox(height: 12),
            SegmentedButton<HabitFrequency>(
              segments: const [
                ButtonSegment(value: HabitFrequency.daily, label: Text('Daily')),
                ButtonSegment(value: HabitFrequency.weekly, label: Text('Weekly')),
              ],
              selected: {_frequency},
              onSelectionChanged: (s) => setState(() => _frequency = s.first),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _submit, child: Text(_isEditing ? 'Save changes' : 'Add habit')),
            ),
          ],
        ),
      ),
    );
  }
}
