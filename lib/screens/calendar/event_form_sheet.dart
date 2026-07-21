import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/work_category.dart';
import '../../providers/calendar_provider.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/work_category_selector.dart';

class EventFormSheet extends ConsumerStatefulWidget {
  final DateTime initialDate;

  const EventFormSheet({super.key, required this.initialDate});

  @override
  ConsumerState<EventFormSheet> createState() => _EventFormSheetState();
}

class _EventFormSheetState extends ConsumerState<EventFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();
  late DateTime _date;
  TimeOfDay? _time;
  WorkCategory _category = WorkCategory.other;

  @override
  void initState() {
    super.initState();
    _date = widget.initialDate;
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
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (picked != null) setState(() => _time = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(eventsProvider.notifier).addEvent(
          title: _titleController.text.trim(),
          date: _date,
          hour: _time?.hour,
          minute: _time?.minute,
          notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
          category: _category,
        );
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
            Text('New event', style: Theme.of(context).textTheme.titleLarge),
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
              child: FilledButton(onPressed: _submit, child: const Text('Add event')),
            ),
          ],
        ),
      ),
    );
  }
}
