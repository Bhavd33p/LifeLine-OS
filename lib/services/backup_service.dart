import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'storage_service.dart';

/// Exports every Hive box to a single JSON file (for the user to save
/// wherever they like) and restores from that same format. Everything
/// happens on-device — no server involved.
class BackupService {
  BackupService._();

  static const int backupFormatVersion = 1;

  static Map<String, dynamic> _buildBackupMap() {
    return {
      'formatVersion': backupFormatVersion,
      'exportedAt': DateTime.now().toIso8601String(),
      'tasks': StorageService.tasksBox.values.toList(),
      'habits': StorageService.habitsBox.values.toList(),
      'habitLogs': StorageService.habitLogsBox.values.toList(),
      'transactions': StorageService.transactionsBox.values.toList(),
      'healthEntries': StorageService.healthBox.values.toList(),
      'events': StorageService.eventsBox.values.toList(),
      'timetableBlocks': StorageService.timetableBox.values.toList(),
      'template': StorageService.templateBox.values.toList(),
    };
  }

  /// Writes a backup JSON file to a temp directory and opens the native
  /// share sheet so the user can save it to Files/Drive/email/etc.
  static Future<void> exportAndShare() async {
    final map = _buildBackupMap();
    final jsonStr = const JsonEncoder.withIndent('  ').convert(map);
    final dir = await getTemporaryDirectory();
    final stamp = DateTime.now().toIso8601String().split('T').first;
    final file = File('${dir.path}/personal_os_backup_$stamp.json');
    await file.writeAsString(jsonStr);
    await Share.shareXFiles([XFile(file.path)], text: 'Personal OS backup');
  }

  /// Lets the user pick a `.json` backup file and restores every box from
  /// it. Existing data in each box is replaced.
  static Future<bool> pickAndImport() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
    );
    final path = result?.files.single.path;
    if (path == null) return false;
    final content = await File(path).readAsString();
    await restoreFromJson(content);
    return true;
  }

  static Future<void> restoreFromJson(String jsonStr) async {
    final data = jsonDecode(jsonStr) as Map<String, dynamic>;
    await _restoreBox(StorageService.tasksBox, data['tasks']);
    await _restoreBox(StorageService.habitsBox, data['habits']);
    await _restoreBox(StorageService.habitLogsBox, data['habitLogs']);
    await _restoreBox(StorageService.transactionsBox, data['transactions']);
    await _restoreBox(StorageService.healthBox, data['healthEntries']);
    await _restoreBox(StorageService.eventsBox, data['events']);
    await _restoreBox(StorageService.timetableBox, data['timetableBlocks']);
    await _restoreBox(StorageService.templateBox, data['template']);
  }

  static Future<void> _restoreBox(Box<Map> box, dynamic rawList) async {
    if (rawList is! List) return;
    await box.clear();
    for (final item in rawList) {
      if (item is Map && item['id'] is String) {
        await box.put(item['id'] as String, Map<String, dynamic>.from(item));
      }
    }
  }

  static Future<void> clearAllData() async {
    await StorageService.tasksBox.clear();
    await StorageService.habitsBox.clear();
    await StorageService.habitLogsBox.clear();
    await StorageService.transactionsBox.clear();
    await StorageService.healthBox.clear();
    await StorageService.eventsBox.clear();
    await StorageService.timetableBox.clear();
    await StorageService.templateBox.clear();
  }
}
