enum TransactionType { income, expense }

TransactionType transactionTypeFromName(String? name) => TransactionType.values.firstWhere(
      (t) => t.name == name,
      orElse: () => TransactionType.expense,
    );

const List<String> expenseCategories = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Shopping',
  'Health',
  'Entertainment',
  'Subscriptions',
  'Other',
];

const List<String> incomeCategories = [
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Other',
];

class MoneyTransaction {
  final String id;
  final double amount;
  final TransactionType type;
  final String category;
  final String? note;
  final DateTime date;

  const MoneyTransaction({
    required this.id,
    required this.amount,
    required this.type,
    required this.category,
    this.note,
    required this.date,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'amount': amount,
        'type': type.name,
        'category': category,
        'note': note,
        'date': date.toIso8601String(),
      };

  factory MoneyTransaction.fromMap(Map<dynamic, dynamic> map) => MoneyTransaction(
        id: map['id'] as String,
        amount: (map['amount'] as num).toDouble(),
        type: transactionTypeFromName(map['type'] as String?),
        category: map['category'] as String,
        note: map['note'] as String?,
        date: DateTime.parse(map['date'] as String),
      );
}
