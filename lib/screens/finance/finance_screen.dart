import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/transaction.dart';
import '../../providers/finance_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/section_card.dart';
import '../../widgets/stat_tile.dart';
import 'transaction_form_sheet.dart';

class FinanceScreen extends ConsumerWidget {
  const FinanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(monthlySummaryProvider);
    final breakdown = ref.watch(categoryBreakdownProvider);
    final transactions = ref.watch(transactionsProvider);
    final maxCategory = breakdown.isEmpty ? 0.0 : breakdown.first.value;
    final currencySymbol = ref.watch(settingsProvider).currencySymbol;
    final currency = NumberFormat.currency(symbol: currencySymbol);

    return Scaffold(
      appBar: AppBar(title: const Text('Finance')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (_) => const TransactionFormSheet(),
        ),
        child: const Icon(Icons.add),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: StatTile(
                  label: 'Income',
                  value: currency.format(summary.income),
                  icon: Icons.arrow_downward,
                  color: Colors.green,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: StatTile(
                  label: 'Expense',
                  value: currency.format(summary.expense),
                  icon: Icons.arrow_upward,
                  color: Colors.redAccent,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: StatTile(
                  label: 'Net',
                  value: currency.format(summary.net),
                  icon: Icons.savings_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'This month by category',
            child: breakdown.isEmpty
                ? const EmptyState(icon: Icons.pie_chart_outline, message: 'No expenses logged this month yet.')
                : Column(
                    children: breakdown
                        .map((entry) => _CategoryBar(
                              label: entry.key,
                              amount: entry.value,
                              fraction: maxCategory == 0 ? 0 : entry.value / maxCategory,
                              currency: currency,
                            ))
                        .toList(),
                  ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: 'All transactions',
            child: transactions.isEmpty
                ? const EmptyState(icon: Icons.receipt_long_outlined, message: 'No transactions yet.')
                : Column(
                    children: transactions
                        .map((t) => _TransactionRow(transaction: t, currency: currency))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _CategoryBar extends StatelessWidget {
  final String label;
  final double amount;
  final double fraction;
  final NumberFormat currency;

  const _CategoryBar({
    required this.label,
    required this.amount,
    required this.fraction,
    required this.currency,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodyMedium),
              Text(currency.format(amount), style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: fraction.clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: const Color(0xFFEFEAF6),
            ),
          ),
        ],
      ),
    );
  }
}

class _TransactionRow extends ConsumerWidget {
  final MoneyTransaction transaction;
  final NumberFormat currency;

  const _TransactionRow({required this.transaction, required this.currency});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isExpense = transaction.type == TransactionType.expense;
    return Dismissible(
      key: ValueKey(transaction.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 12),
        child: const Icon(Icons.delete, color: Colors.redAccent),
      ),
      onDismissed: (_) => ref.read(transactionsProvider.notifier).deleteTransaction(transaction.id),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(
          backgroundColor: (isExpense ? Colors.redAccent : Colors.green).withValues(alpha: 0.12),
          child: Icon(
            isExpense ? Icons.arrow_upward : Icons.arrow_downward,
            color: isExpense ? Colors.redAccent : Colors.green,
            size: 18,
          ),
        ),
        title: Text(transaction.category),
        subtitle: Text(
          transaction.note != null
              ? '${DateFormat.yMMMd().format(transaction.date)} · ${transaction.note}'
              : DateFormat.yMMMd().format(transaction.date),
        ),
        trailing: Text(
          '${isExpense ? '-' : '+'}${currency.format(transaction.amount)}',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: isExpense ? Colors.redAccent : Colors.green,
          ),
        ),
      ),
    );
  }
}
