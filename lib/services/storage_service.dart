import 'package:hive_flutter/hive_flutter.dart';

/// Thin wrapper around Hive: opens one box per domain on startup and
/// exposes typed getters. All data lives on-device only — nothing here
/// ever talks to a network.
class StorageService {
  StorageService._();

  static const String tasksBoxName = 'tasks';
  static const String habitsBoxName = 'habits';
  static const String habitLogsBoxName = 'habit_logs';
  static const String transactionsBoxName = 'transactions';
  static const String healthBoxName = 'health_entries';
  static const String eventsBoxName = 'events';

  static Future<void> init() async {
    await Hive.initFlutter();
    await Future.wait([
      Hive.openBox<Map>(tasksBoxName),
      Hive.openBox<Map>(habitsBoxName),
      Hive.openBox<Map>(habitLogsBoxName),
      Hive.openBox<Map>(transactionsBoxName),
      Hive.openBox<Map>(healthBoxName),
      Hive.openBox<Map>(eventsBoxName),
    ]);
  }

  static Box<Map> get tasksBox => Hive.box<Map>(tasksBoxName);
  static Box<Map> get habitsBox => Hive.box<Map>(habitsBoxName);
  static Box<Map> get habitLogsBox => Hive.box<Map>(habitLogsBoxName);
  static Box<Map> get transactionsBox => Hive.box<Map>(transactionsBoxName);
  static Box<Map> get healthBox => Hive.box<Map>(healthBoxName);
  static Box<Map> get eventsBox => Hive.box<Map>(eventsBoxName);
}
