import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../models/transaction.dart';
import '../services/storage_service.dart';

const _uuid = Uuid();

class TransactionsNotifier extends StateNotifier<List<MoneyTransaction>> {
  TransactionsNotifier() : super(_loadAll());

  static List<MoneyTransaction> _loadAll() {
    final items =
        StorageService.transactionsBox.values.map(MoneyTransaction.fromMap).toList();
    items.sort((a, b) => b.date.compareTo(a.date));
    return items;
  }

  Future<void> addTransaction({
    required double amount,
    required TransactionType type,
    required String category,
    String? note,
    required DateTime date,
  }) async {
    final tx = MoneyTransaction(
      id: _uuid.v4(),
      amount: amount,
      type: type,
      category: category,
      note: note,
      date: date,
    );
    await StorageService.transactionsBox.put(tx.id, tx.toMap());
    state = _loadAll();
  }

  Future<void> deleteTransaction(String id) async {
    await StorageService.transactionsBox.delete(id);
    state = _loadAll();
  }

  void reload() => state = _loadAll();
}

final transactionsProvider =
    StateNotifierProvider<TransactionsNotifier, List<MoneyTransaction>>(
  (ref) => TransactionsNotifier(),
);

class MonthlySummary {
  final double income;
  final double expense;

  const MonthlySummary({required this.income, required this.expense});

  double get net => income - expense;
}

final monthlySummaryProvider = Provider<MonthlySummary>((ref) {
  final now = DateTime.now();
  final txs = ref.watch(transactionsProvider).where(
        (t) => t.date.year == now.year && t.date.month == now.month,
      );
  double income = 0;
  double expense = 0;
  for (final t in txs) {
    if (t.type == TransactionType.income) {
      income += t.amount;
    } else {
      expense += t.amount;
    }
  }
  return MonthlySummary(income: income, expense: expense);
});

/// Expense total per category for the current month, sorted descending.
final categoryBreakdownProvider = Provider<List<MapEntry<String, double>>>((ref) {
  final now = DateTime.now();
  final txs = ref.watch(transactionsProvider).where(
        (t) =>
            t.type == TransactionType.expense &&
            t.date.year == now.year &&
            t.date.month == now.month,
      );
  final totals = <String, double>{};
  for (final t in txs) {
    totals.update(t.category, (v) => v + t.amount, ifAbsent: () => t.amount);
  }
  final entries = totals.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  return entries;
});
