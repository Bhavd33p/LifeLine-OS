import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/calendar_provider.dart';
import '../../providers/finance_provider.dart';
import '../../providers/habits_provider.dart';
import '../../providers/health_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/tasks_provider.dart';
import '../../providers/timetable_provider.dart';
import '../../services/backup_service.dart';
import '../../widgets/reminder_settings_section.dart';
import '../../widgets/section_card.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: 'Appearance',
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.system, label: Text('System'), icon: Icon(Icons.brightness_auto)),
                ButtonSegment(value: ThemeMode.light, label: Text('Light'), icon: Icon(Icons.light_mode)),
                ButtonSegment(value: ThemeMode.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode)),
              ],
              selected: {settings.themeMode},
              onSelectionChanged: (s) => ref.read(settingsProvider.notifier).setThemeMode(s.first),
              showSelectedIcon: false,
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Finance currency',
            child: Wrap(
              spacing: 8,
              children: currencySymbols
                  .map(
                    (symbol) => ChoiceChip(
                      label: Text(symbol),
                      selected: settings.currencySymbol == symbol,
                      onSelected: (_) => ref.read(settingsProvider.notifier).setCurrencySymbol(symbol),
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          const SectionCard(title: 'Plan-tomorrow reminder', child: ReminderSettingsSection()),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Data',
            child: Column(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.ios_share),
                  title: const Text('Export backup'),
                  subtitle: const Text('Share a JSON file with all your data'),
                  onTap: () => BackupService.exportAndShare(),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.file_upload_outlined),
                  title: const Text('Import backup'),
                  subtitle: const Text('Restore from a previously exported JSON file'),
                  onTap: () => _import(context, ref),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.delete_forever, color: Theme.of(context).colorScheme.error),
                  title: Text('Clear all data', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  subtitle: const Text('Permanently erase everything on this device'),
                  onTap: () => _clear(context, ref),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'About',
            child: Text(
              'Personal OS v1.0.0\nLocal-first — your data never leaves this device.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _import(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Import backup?'),
        content: const Text(
          'This replaces all current data on this device with the contents of the backup file.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Choose file')),
        ],
      ),
    );
    if (confirmed != true) return;
    final imported = await BackupService.pickAndImport();
    if (!context.mounted) return;
    if (imported) {
      _reloadAllProviders(ref);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Backup imported')));
    }
  }

  Future<void> _clear(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all data?'),
        content: const Text(
          'This permanently deletes every task, habit, transaction, health entry, event, '
          'and timetable block on this device. This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete everything'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await BackupService.clearAllData();
    if (!context.mounted) return;
    _reloadAllProviders(ref);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('All data cleared')));
  }

  void _reloadAllProviders(WidgetRef ref) {
    ref.read(tasksProvider.notifier).reload();
    ref.read(habitsProvider.notifier).reload();
    ref.read(habitLogsProvider.notifier).reload();
    ref.read(transactionsProvider.notifier).reload();
    ref.read(healthEntriesProvider.notifier).reload();
    ref.read(eventsProvider.notifier).reload();
    ref.read(timetableProvider.notifier).reload();
    ref.read(templateProvider.notifier).reload();
  }
}
