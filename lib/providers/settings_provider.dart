import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/notification_service.dart';
import '../services/storage_service.dart';

class ReminderSettings {
  final bool enabled;
  final int hour;
  final int minute;

  const ReminderSettings({required this.enabled, required this.hour, required this.minute});
}

class SettingsNotifier extends StateNotifier<ReminderSettings> {
  SettingsNotifier() : super(_load()) {
    if (state.enabled) {
      NotificationService.scheduleDailyPlanningReminder(hour: state.hour, minute: state.minute);
    }
  }

  static ReminderSettings _load() {
    final box = StorageService.settingsBox;
    return ReminderSettings(
      enabled: (box.get('reminderEnabled') as bool?) ?? true,
      hour: (box.get('reminderHour') as int?) ?? 20,
      minute: (box.get('reminderMinute') as int?) ?? 0,
    );
  }

  Future<void> setTime(int hour, int minute) async {
    final box = StorageService.settingsBox;
    await box.put('reminderHour', hour);
    await box.put('reminderMinute', minute);
    state = ReminderSettings(enabled: state.enabled, hour: hour, minute: minute);
    if (state.enabled) {
      await NotificationService.scheduleDailyPlanningReminder(hour: hour, minute: minute);
    }
  }

  Future<void> setEnabled(bool enabled) async {
    await StorageService.settingsBox.put('reminderEnabled', enabled);
    state = ReminderSettings(enabled: enabled, hour: state.hour, minute: state.minute);
    if (enabled) {
      await NotificationService.scheduleDailyPlanningReminder(hour: state.hour, minute: state.minute);
    } else {
      await NotificationService.cancelReminder();
    }
  }
}

final settingsProvider = StateNotifierProvider<SettingsNotifier, ReminderSettings>(
  (ref) => SettingsNotifier(),
);
