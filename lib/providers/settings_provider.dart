import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/notification_service.dart';
import '../services/storage_service.dart';

const List<String> currencySymbols = ['\$', '€', '£', '₹', '¥'];

ThemeMode _themeModeFromName(String? name) {
  switch (name) {
    case 'light':
      return ThemeMode.light;
    case 'dark':
      return ThemeMode.dark;
    default:
      return ThemeMode.system;
  }
}

class AppSettings {
  final bool reminderEnabled;
  final int reminderHour;
  final int reminderMinute;
  final ThemeMode themeMode;
  final String currencySymbol;

  const AppSettings({
    required this.reminderEnabled,
    required this.reminderHour,
    required this.reminderMinute,
    required this.themeMode,
    required this.currencySymbol,
  });

  AppSettings copyWith({
    bool? reminderEnabled,
    int? reminderHour,
    int? reminderMinute,
    ThemeMode? themeMode,
    String? currencySymbol,
  }) {
    return AppSettings(
      reminderEnabled: reminderEnabled ?? this.reminderEnabled,
      reminderHour: reminderHour ?? this.reminderHour,
      reminderMinute: reminderMinute ?? this.reminderMinute,
      themeMode: themeMode ?? this.themeMode,
      currencySymbol: currencySymbol ?? this.currencySymbol,
    );
  }
}

class SettingsNotifier extends StateNotifier<AppSettings> {
  SettingsNotifier() : super(_load()) {
    if (state.reminderEnabled) {
      NotificationService.scheduleDailyPlanningReminder(
        hour: state.reminderHour,
        minute: state.reminderMinute,
      );
    }
  }

  static AppSettings _load() {
    final box = StorageService.settingsBox;
    return AppSettings(
      reminderEnabled: (box.get('reminderEnabled') as bool?) ?? true,
      reminderHour: (box.get('reminderHour') as int?) ?? 20,
      reminderMinute: (box.get('reminderMinute') as int?) ?? 0,
      themeMode: _themeModeFromName(box.get('themeMode') as String?),
      currencySymbol: (box.get('currencySymbol') as String?) ?? currencySymbols.first,
    );
  }

  Future<void> setReminderTime(int hour, int minute) async {
    final box = StorageService.settingsBox;
    await box.put('reminderHour', hour);
    await box.put('reminderMinute', minute);
    state = state.copyWith(reminderHour: hour, reminderMinute: minute);
    if (state.reminderEnabled) {
      await NotificationService.scheduleDailyPlanningReminder(hour: hour, minute: minute);
    }
  }

  Future<void> setReminderEnabled(bool enabled) async {
    await StorageService.settingsBox.put('reminderEnabled', enabled);
    state = state.copyWith(reminderEnabled: enabled);
    if (enabled) {
      await NotificationService.scheduleDailyPlanningReminder(
        hour: state.reminderHour,
        minute: state.reminderMinute,
      );
    } else {
      await NotificationService.cancelReminder();
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    final name = mode == ThemeMode.light ? 'light' : (mode == ThemeMode.dark ? 'dark' : 'system');
    await StorageService.settingsBox.put('themeMode', name);
    state = state.copyWith(themeMode: mode);
  }

  Future<void> setCurrencySymbol(String symbol) async {
    await StorageService.settingsBox.put('currencySymbol', symbol);
    state = state.copyWith(currencySymbol: symbol);
  }
}

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>(
  (ref) => SettingsNotifier(),
);
