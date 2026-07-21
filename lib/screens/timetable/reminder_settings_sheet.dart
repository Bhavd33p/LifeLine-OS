import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/settings_provider.dart';

class ReminderSettingsSheet extends ConsumerWidget {
  const ReminderSettingsSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final time = TimeOfDay(hour: settings.hour, minute: settings.minute);

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Plan-tomorrow reminder', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            "A daily nudge to build tomorrow's timetable.",
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Enabled'),
            value: settings.enabled,
            onChanged: (v) => ref.read(settingsProvider.notifier).setEnabled(v),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Time'),
            subtitle: Text(time.format(context)),
            trailing: const Icon(Icons.chevron_right),
            enabled: settings.enabled,
            onTap: () async {
              final picked = await showTimePicker(context: context, initialTime: time);
              if (picked != null) {
                ref.read(settingsProvider.notifier).setTime(picked.hour, picked.minute);
              }
            },
          ),
        ],
      ),
    );
  }
}
