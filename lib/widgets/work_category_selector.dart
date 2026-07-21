import 'package:flutter/material.dart';

import '../models/work_category.dart';

class WorkCategorySelector extends StatelessWidget {
  final WorkCategory value;
  final ValueChanged<WorkCategory> onChanged;

  const WorkCategorySelector({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<WorkCategory>(
      segments: WorkCategory.values
          .map((c) => ButtonSegment(value: c, label: Text(c.label), icon: Icon(c.icon, size: 16)))
          .toList(),
      selected: {value},
      onSelectionChanged: (s) => onChanged(s.first),
      showSelectedIcon: false,
    );
  }
}

class WorkCategoryBadge extends StatelessWidget {
  final WorkCategory category;

  const WorkCategoryBadge({super.key, required this.category});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: category.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(category.icon, size: 12, color: category.color),
          const SizedBox(width: 4),
          Text(category.label, style: TextStyle(fontSize: 11, color: category.color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
