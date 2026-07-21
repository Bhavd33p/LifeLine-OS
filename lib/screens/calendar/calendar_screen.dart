import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/event.dart';
import '../../providers/calendar_provider.dart';
import '../../utils/date_utils.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/section_card.dart';
import 'event_form_sheet.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _visibleMonth;
  late DateTime _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month);
    _selectedDay = dateOnly(now);
  }

  void _changeMonth(int delta) {
    setState(() => _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + delta));
  }

  @override
  Widget build(BuildContext context) {
    final marked = ref.watch(markedDaysInMonthProvider(_visibleMonth));
    final agenda = ref.watch(agendaForDayProvider(_selectedDay));
    final scheme = Theme.of(context).colorScheme;

    final firstOfMonth = DateTime(_visibleMonth.year, _visibleMonth.month, 1);
    final daysInMonth = endOfMonth(_visibleMonth).day;
    final leadingBlanks = firstOfMonth.weekday - 1;
    final totalCells = ((leadingBlanks + daysInMonth) / 7).ceil() * 7;

    return Scaffold(
      appBar: AppBar(title: const Text('Calendar')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (_) => EventFormSheet(initialDate: _selectedDay),
        ),
        child: const Icon(Icons.add),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(onPressed: () => _changeMonth(-1), icon: const Icon(Icons.chevron_left)),
              Text(DateFormat.yMMMM().format(_visibleMonth), style: Theme.of(context).textTheme.titleMedium),
              IconButton(onPressed: () => _changeMonth(1), icon: const Icon(Icons.chevron_right)),
            ],
          ),
          const _WeekdayHeader(),
          const SizedBox(height: 4),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7),
            itemCount: totalCells,
            itemBuilder: (context, index) {
              final dayNum = index - leadingBlanks + 1;
              if (dayNum < 1 || dayNum > daysInMonth) return const SizedBox.shrink();
              final day = DateTime(_visibleMonth.year, _visibleMonth.month, dayNum);
              final isSelected = isSameDay(day, _selectedDay);
              final isToday = isSameDay(day, DateTime.now());
              final hasMark = marked.contains(day);
              return GestureDetector(
                onTap: () => setState(() => _selectedDay = day),
                child: Container(
                  margin: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? scheme.primary
                        : (isToday ? scheme.primary.withValues(alpha: 0.12) : null),
                    shape: BoxShape.circle,
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Text('$dayNum', style: TextStyle(color: isSelected ? Colors.white : null)),
                      if (hasMark && !isSelected)
                        Positioned(
                          bottom: 4,
                          child: Container(
                            width: 4,
                            height: 4,
                            decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: DateFormat.yMMMEd().format(_selectedDay),
            child: agenda.isEmpty
                ? const EmptyState(icon: Icons.event_available, message: 'Nothing scheduled.')
                : Column(
                    children: [
                      ...agenda.events.map((e) => _EventRow(event: e)),
                      ...agenda.taskTitlesDue.map(
                        (t) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.check_circle_outline),
                          title: Text(t),
                          subtitle: const Text('Task due'),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _WeekdayHeader extends StatelessWidget {
  const _WeekdayHeader();

  static const _labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: _labels
          .map((l) => Expanded(
                child: Center(
                  child: Text(l, style: Theme.of(context).textTheme.bodySmall),
                ),
              ))
          .toList(),
    );
  }
}

class _EventRow extends ConsumerWidget {
  final CalendarEvent event;

  const _EventRow({required this.event});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeLabel = event.hasTime
        ? TimeOfDay(hour: event.hour!, minute: event.minute ?? 0).format(context)
        : 'All day';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.event_note),
      title: Text(event.title),
      subtitle: Text(event.notes != null ? '$timeLabel · ${event.notes}' : timeLabel),
      trailing: IconButton(
        icon: const Icon(Icons.close, size: 18),
        onPressed: () => ref.read(eventsProvider.notifier).deleteEvent(event.id),
      ),
    );
  }
}
