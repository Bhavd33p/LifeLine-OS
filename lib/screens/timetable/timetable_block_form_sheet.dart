import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/timetable_block.dart';
import '../../models/work_category.dart';
import '../../providers/timetable_provider.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/work_category_selector.dart';

class TimetableBlockFormSheet extends ConsumerStatefulWidget {
  final DateTime date;
  final TimetableBlock? existing;

  const TimetableBlockFormSheet({super.key, required this.date, this.existing});

  @override
  ConsumerState<TimetableBlockFormSheet> createState() => _TimetableBlockFormSheetState();
}

class _TimetableBlockFormSheetState extends ConsumerState<TimetableBlockFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _titleController = TextEditingController(text: widget.existing?.title ?? '');
  late final _notesController = TextEditingController(text: widget.existing?.notes ?? '');
  late TimeOfDay _start = widget.existing != null
      ? TimeOfDay(hour: widget.existing!.startHour, minute: widget.existing!.startMinute)
      : const TimeOfDay(hour: 9, minute: 0);
  late TimeOfDay _end = widget.existing != null
      ? TimeOfDay(hour: widget.existing!.endHour, minute: widget.existing!.endMinute)
      : const TimeOfDay(hour: 10, minute: 0);
  late WorkCategory _category = widget.existing?.category ?? WorkCategory.other;
  String? _timeError;

  bool get _isEditing => widget.existing != null;

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickStart() async {
    final picked = await showTimePicker(context: context, initialTime: _start);
    if (picked != null) setState(() => _start = picked);
  }

  Future<void> _pickEnd() async {
    final picked = await showTimePicker(context: context, initialTime: _end);
    if (picked != null) setState(() => _end = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final startMinutes = _start.hour * 60 + _start.minute;
    final endMinutes = _end.hour * 60 + _end.minute;
    if (endMinutes <= startMinutes) {
      setState(() => _timeError = 'End time must be after start time');
      return;
    }
    setState(() => _timeError = null);

    final title = _titleController.text.trim();
    final notes = _notesController.text.trim().isEmpty ? null : _notesController.text.trim();
    if (_isEditing) {
      ref.read(timetableProvider.notifier).updateBlock(
            TimetableBlock(
              id: widget.existing!.id,
              date: widget.date,
              title: title,
              startHour: _start.hour,
              startMinute: _start.minute,
              endHour: _end.hour,
              endMinute: _end.minute,
              category: _category,
              notes: notes,
            ),
          );
    } else {
      ref.read(timetableProvider.notifier).addBlock(
            date: widget.date,
            title: title,
            startHour: _start.hour,
            startMinute: _start.minute,
            endHour: _end.hour,
            endMinute: _end.minute,
            category: _category,
            notes: notes,
          );
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
            Text(_isEditing ? 'Edit time block' : 'New time block', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            AppTextField(
              controller: _titleController,
              label: 'What are you doing?',
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickStart,
                    icon: const Icon(Icons.schedule),
                    label: Text('Start ${_start.format(context)}'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickEnd,
                    icon: const Icon(Icons.schedule),
                    label: Text('End ${_end.format(context)}'),
                  ),
                ),
              ],
            ),
            if (_timeError != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(_timeError!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12)),
              ),
            const SizedBox(height: 12),
            AppTextField(controller: _notesController, label: 'Notes (optional)', maxLines: 2),
            const SizedBox(height: 12),
            WorkCategorySelector(value: _category, onChanged: (c) => setState(() => _category = c)),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _submit, child: Text(_isEditing ? 'Save changes' : 'Add block')),
            ),
          ],
        ),
      ),
    );
  }
}
