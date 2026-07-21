import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/timetable_block.dart';
import '../../providers/timetable_provider.dart';
import '../../utils/date_utils.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/work_category_selector.dart';
import 'reminder_settings_sheet.dart';
import 'timetable_block_form_sheet.dart';

class TimetableScreen extends ConsumerStatefulWidget {
  const TimetableScreen({super.key});

  @override
  ConsumerState<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends ConsumerState<TimetableScreen> {
  late DateTime _selectedDay;

  @override
  void initState() {
    super.initState();
    _selectedDay = dateOnly(DateTime.now()).add(const Duration(days: 1));
  }

  void _changeDay(int delta) {
    setState(() => _selectedDay = _selectedDay.add(Duration(days: delta)));
  }

  String _dayLabel() {
    final today = dateOnly(DateTime.now());
    if (isSameDay(_selectedDay, today)) return 'Today';
    if (isSameDay(_selectedDay, today.add(const Duration(days: 1)))) return 'Tomorrow';
    if (isSameDay(_selectedDay, today.subtract(const Duration(days: 1)))) return 'Yesterday';
    return DateFormat.yMMMEd().format(_selectedDay);
  }

  Future<void> _applyTemplate() async {
    final template = ref.read(templateProvider);
    if (template.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No saved template yet — build a day and "Save as template" first.')),
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Load template?'),
        content: Text("This replaces ${_dayLabel()}'s current blocks with your saved template."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Load')),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(timetableProvider.notifier).applyTemplate(_selectedDay, template);
    }
  }

  Future<void> _saveAsTemplate(List<TimetableBlock> dayBlocks) async {
    if (dayBlocks.isEmpty) return;
    await ref.read(templateProvider.notifier).saveFromDay(_selectedDay, dayBlocks);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved as your daily template')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final blocks = ref.watch(blocksForDayProvider(_selectedDay));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Timetable'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Reminder settings',
            onPressed: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              builder: (_) => const ReminderSettingsSheet(),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (_) => TimetableBlockFormSheet(date: _selectedDay),
        ),
        child: const Icon(Icons.add),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(onPressed: () => _changeDay(-1), icon: const Icon(Icons.chevron_left)),
              Column(
                children: [
                  Text(_dayLabel(), style: Theme.of(context).textTheme.titleMedium),
                  Text(DateFormat.yMMMd().format(_selectedDay), style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
              IconButton(onPressed: () => _changeDay(1), icon: const Icon(Icons.chevron_right)),
            ],
          ),
          const SizedBox(height: 12),
          if (blocks.isEmpty)
            const EmptyState(
              icon: Icons.view_timeline_outlined,
              message: 'Nothing planned yet.\nTap + to add a block, or load your template.',
            )
          else
            Column(children: blocks.map((b) => _BlockTile(block: b)).toList()),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _applyTemplate,
                  icon: const Icon(Icons.download_outlined),
                  label: const Text('Load template'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _saveAsTemplate(blocks),
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Save as template'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BlockTile extends ConsumerWidget {
  final TimetableBlock block;

  const _BlockTile({required this.block});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = TimeOfDay(hour: block.startHour, minute: block.startMinute).format(context);
    final end = TimeOfDay(hour: block.endHour, minute: block.endMinute).format(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 64,
              child: Text(
                '$start\n$end',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(block.title, style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      WorkCategoryBadge(category: block.category),
                      if (block.notes != null) ...[
                        const SizedBox(width: 6),
                        Flexible(child: Text(block.notes!, overflow: TextOverflow.ellipsis)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: () => ref.read(timetableProvider.notifier).deleteBlock(block.id),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
      ),
    );
  }
}
