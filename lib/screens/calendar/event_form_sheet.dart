import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/event.dart';
import '../../models/work_category.dart';
import '../../providers/calendar_provider.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/work_category_selector.dart';

class EventFormSheet extends ConsumerStatefulWidget {
  final DateTime initialDate;
  final CalendarEvent? existing;

  const EventFormSheet({super.key, required this.initialDate, this.existing});

  @override
  ConsumerState<EventFormSheet> createState() => _EventFormSheetState();
}

class _EventFormSheetState extends ConsumerState<EventFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _titleController = TextEditingController(text: widget.existing?.title ?? '');
  late final _notesController = TextEditingController(text: widget.existing?.notes ?? '');
  late DateTime _date;
  late TimeOfDay? _time;
  late WorkCategory _category = widget.existing?.category ?? WorkCategory.other;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _date = existing?.date ?? widget.initialDate;
    _time = existing?.hasTime == true ? TimeOfDay(hour: existing!.hour!, minute: existing.minute ?? 0) : null;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time ?? TimeOfDay.now());
    if (picked != null) setState(() => _time = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final title = _titleController.text.trim();
    final notes = _notesController.text.trim().isEmpty ? null : _notesController.text.trim();
    if (_isEditing) {
      ref.read(eventsProvider.notifier).updateEvent(
            CalendarEvent(
              id: widget.existing!.id,
              title: title,
              date: _date,
              hour: _time?.hour,
              minute: _time?.minute,
              notes: notes,
              category: _category,
            ),
          );
    } else {
      ref.read(eventsProvider.notifier).addEvent(
            title: title,
            date: _date,
            hour: _time?.hour,
            minute: _time?.minute,
            notes: notes,
            category: _category,
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
            Text(_isEditing ? 'Edit event' : 'New event', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            AppTextField(
              controller: _titleController,
              label: 'Title',
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickDate,
                    icon: const Icon(Icons.event),
                    label: Text(DateFormat.yMMMd().format(_date)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickTime,
                    icon: const Icon(Icons.access_time),
                    label: Text(_time == null ? 'Time' : _time!.format(context)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AppTextField(controller: _notesController, label: 'Notes (optional)', maxLines: 2),
            const SizedBox(height: 12),
            WorkCategorySelector(value: _category, onChanged: (c) => setState(() => _category = c)),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _submit, child: Text(_isEditing ? 'Save changes' : 'Add event')),
            ),
          ],
        ),
      ),
    );
  }
}
