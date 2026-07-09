import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class OrderSummary extends StatelessWidget {
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final double totalAmount;
  final String? couponCode;
  final int itemCount;
  final bool isLoading;

  const OrderSummary({
    super.key,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.totalAmount,
    this.couponCode,
    required this.itemCount,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: '₫',
      decimalDigits: 0,
    );

    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tóm tắt đơn hàng',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '$itemCount sản phẩm',
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade600,
              ),
            ),
            const Divider(height: 24),
            _SummaryRow(
              label: 'Tạm tính',
              value: formatter.format(subtotal),
            ),
            const SizedBox(height: 8),
            _SummaryRow(
              label: 'Phí vận chuyển',
              value: shippingFee > 0
                  ? formatter.format(shippingFee)
                  : 'Đang tính...',
              isLoading: shippingFee <= 0,
            ),
            if (discountAmount > 0) ...[
              const SizedBox(height: 8),
              _SummaryRow(
                label: 'Giảm giá',
                value: '-${formatter.format(discountAmount)}',
                valueColor: Colors.green,
                suffix: couponCode != null ? '($couponCode)' : null,
              ),
            ],
            const Divider(height: 24),
            _SummaryRow(
              label: 'Tổng cộng',
              value: formatter.format(totalAmount),
              isTotal: true,
              isLoading: isLoading,
            ),
            if (totalAmount >= 500000 && discountAmount == 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue.shade200),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.local_shipping_outlined,
                      size: 20,
                      color: Colors.blue.shade700,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Đơn hàng trên 500.000₫ được miễn phí vận chuyển!',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.blue.shade700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isTotal;
  final bool isLoading;
  final Color? valueColor;
  final String? suffix;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.isTotal = false,
    this.isLoading = false,
    this.valueColor,
    this.suffix,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isTotal ? 16 : 14,
            fontWeight: isTotal ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (suffix != null) ...[
              Text(
                suffix!,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade600,
                ),
              ),
              const SizedBox(width: 4),
            ],
            if (isLoading)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Text(
                value,
                style: TextStyle(
                  fontSize: isTotal ? 18 : 14,
                  fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
                  color: valueColor ??
                      (isTotal
                          ? Theme.of(context).colorScheme.primary
                          : null),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
