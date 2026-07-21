import 'package:flutter/material.dart';

import 'screens/calendar/calendar_screen.dart';
import 'screens/finance/finance_screen.dart';
import 'screens/health/health_screen.dart';
import 'screens/home_screen.dart';
import 'screens/tasks/tasks_habits_screen.dart';
import 'screens/timetable/timetable_screen.dart';
import 'theme.dart';

class PersonalOsApp extends StatelessWidget {
  const PersonalOsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Personal OS',
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      home: const RootShell(),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  static final _tabs = <Widget>[
    const HomeScreen(),
    const TasksHabitsScreen(),
    const TimetableScreen(),
    const FinanceScreen(),
    const HealthScreen(),
    const CalendarScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _index, children: _tabs),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.check_circle_outline), selectedIcon: Icon(Icons.check_circle), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.view_timeline_outlined), selectedIcon: Icon(Icons.view_timeline), label: 'Timetable'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'Finance'),
          NavigationDestination(icon: Icon(Icons.favorite_outline), selectedIcon: Icon(Icons.favorite), label: 'Health'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Calendar'),
        ],
      ),
    );
  }
}
