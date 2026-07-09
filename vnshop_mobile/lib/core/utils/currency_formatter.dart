class CurrencyFormatter {
  static String format(int amount) {
    // Format as: 1.250.000₫ (no space before ₫)
    final formatted = amount.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (match) => '${match[1]}.',
    );
    return '$formatted₫';
  }
}
