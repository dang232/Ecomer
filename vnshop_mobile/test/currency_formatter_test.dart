import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/utils/currency_formatter.dart';

void main() {
  group('CurrencyFormatter', () {
    group('format', () {
      test('1250000 formats to "1.250.000₫"', () {
        final result = CurrencyFormatter.format(1250000);
        expect(result, '1.250.000₫');
      });

      test('1000 formats to "1.000₫"', () {
        final result = CurrencyFormatter.format(1000);
        expect(result, '1.000₫');
      });

      test('0 formats to "0₫"', () {
        final result = CurrencyFormatter.format(0);
        expect(result, '0₫');
      });

      test('formats large numbers correctly', () {
        expect(CurrencyFormatter.format(999999999), '999.999.999₫');
      });

      test('formats numbers with 3 digits correctly', () {
        expect(CurrencyFormatter.format(100), '100₫');
        expect(CurrencyFormatter.format(999), '999₫');
      });

      test('formats numbers with 4 digits correctly', () {
        expect(CurrencyFormatter.format(1000), '1.000₫');
        expect(CurrencyFormatter.format(9999), '9.999₫');
        expect(CurrencyFormatter.format(99999), '99.999₫');
      });

      test('formats numbers with 5 digits correctly', () {
        expect(CurrencyFormatter.format(10000), '10.000₫');
        expect(CurrencyFormatter.format(99999), '99.999₫');
        expect(CurrencyFormatter.format(999999), '999.999₫');
      });

      test('formats numbers with 6 digits correctly', () {
        expect(CurrencyFormatter.format(100000), '100.000₫');
        expect(CurrencyFormatter.format(999999), '999.999₫');
        expect(CurrencyFormatter.format(1000000), '1.000.000₫');
      });

      test('no space before ₫ symbol', () {
        // Verify the formatter does not add space between number and currency symbol
        final result = CurrencyFormatter.format(100000);
        expect(result.contains(' '), isFalse,
            reason: 'Currency should not contain spaces');
      });

      test('₫ symbol is at the end', () {
        final result = CurrencyFormatter.format(50000);
        expect(result.endsWith('₫'), isTrue,
            reason: 'Currency symbol should be at the end');
      });
    });
  });
}
