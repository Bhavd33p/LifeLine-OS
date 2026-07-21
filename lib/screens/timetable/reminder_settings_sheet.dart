import 'package:flutter/material.dart';

import '../../widgets/reminder_settings_section.dart';

class ReminderSettingsSheet extends StatelessWidget {
  const ReminderSettingsSheet({super.key});

  @override
  Widget build(BuildContext context) {
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
          const ReminderSettingsSection(),
        ],
      ),
    );
  }
}
