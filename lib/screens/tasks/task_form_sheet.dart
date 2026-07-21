import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/task.dart';
import '../../models/work_category.dart';
import '../../providers/tasks_provider.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/work_category_selector.dart';

class TaskFormSheet extends ConsumerStatefulWidget {
  const TaskFormSheet({super.key});

  @override
  ConsumerState<TaskFormSheet> createState() => _TaskFormSheetState();
}

class _TaskFormSheetState extends ConsumerState<TaskFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime? _dueDate;
  TaskPriority _priority = TaskPriority.medium;
  WorkCategory _category = WorkCategory.other;

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDueDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    ref.read(tasksProvider.notifier).addTask(
          title: _titleController.text.trim(),
          notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
          dueDate: _dueDate,
          priority: _priority,
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
            Text('New task', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            AppTextField(
              controller: _titleController,
              label: 'Title',
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 12),
            AppTextField(controller: _notesController, label: 'Notes (optional)', maxLines: 2),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickDueDate,
                    icon: const Icon(Icons.event),
                    label: Text(_dueDate == null ? 'Due date' : DateFormat.yMMMd().format(_dueDate!)),
                  ),
                ),
                const SizedBox(width: 8),
                DropdownButton<TaskPriority>(
                  value: _priority,
                  onChanged: (p) => setState(() => _priority = p ?? TaskPriority.medium),
                  items: TaskPriority.values
                      .map((p) => DropdownMenuItem(value: p, child: Text(p.name)))
                      .toList(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            WorkCategorySelector(value: _category, onChanged: (c) => setState(() => _category = c)),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: _submit, child: const Text('Add task')),
            ),
          ],
        ),
      ),
    );
  }
}
