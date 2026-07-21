import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/settings_provider.dart';

/// The switch + time-picker row for the daily plan-tomorrow reminder.
/// Embedded both in the Timetable screen's quick-access sheet and in the
/// full Settings screen.
class ReminderSettingsSection extends ConsumerWidget {
  const ReminderSettingsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final time = TimeOfDay(hour: settings.reminderHour, minute: settings.reminderMinute);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Enabled'),
          value: settings.reminderEnabled,
          onChanged: (v) => ref.read(settingsProvider.notifier).setReminderEnabled(v),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Time'),
          subtitle: Text(time.format(context)),
          trailing: const Icon(Icons.chevron_right),
          enabled: settings.reminderEnabled,
          onTap: () async {
            final picked = await showTimePicker(context: context, initialTime: time);
            if (picked != null) {
              ref.read(settingsProvider.notifier).setReminderTime(picked.hour, picked.minute);
            }
          },
        ),
      ],
    );
  }
}
