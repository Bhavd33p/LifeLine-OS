import 'package:flutter/material.dart';

enum WorkCategory { office, personal, other }

WorkCategory workCategoryFromName(String? name) => WorkCategory.values.firstWhere(
      (c) => c.name == name,
      orElse: () => WorkCategory.other,
    );

extension WorkCategoryX on WorkCategory {
  String get label {
    switch (this) {
      case WorkCategory.office:
        return 'Office';
      case WorkCategory.personal:
        return 'Personal';
      case WorkCategory.other:
        return 'Other';
    }
  }

  Color get color {
    switch (this) {
      case WorkCategory.office:
        return Colors.indigo;
      case WorkCategory.personal:
        return Colors.teal;
      case WorkCategory.other:
        return Colors.blueGrey;
    }
  }

  IconData get icon {
    switch (this) {
      case WorkCategory.office:
        return Icons.work_outline;
      case WorkCategory.personal:
        return Icons.person_outline;
      case WorkCategory.other:
        return Icons.circle_outlined;
    }
  }
}
