import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// Cart summary widget displaying subtotal, discount, shipping, and total.
class CartSummary extends StatelessWidget {
  const CartSummary({
    super.key,
    required this.subtotal,
    this.discountAmount = 0,
    this.shippingAmount = 0,
    this.shippingNote,
    this.isFreeShipping = false,
  });

  /// Subtotal amount (sum of all items)
  final double subtotal;

  /// Discount amount (from coupons, etc.)
  final double discountAmount;

  /// Shipping amount
  final double shippingAmount;

  /// Optional note for shipping (e.g., "Miễn phí vận chuyển")
  final String? shippingNote;

  /// Whether free shipping is applied
  final bool isFreeShipping;

  /// Total amount after discounts
  double get total => subtotal - discountAmount + (isFreeShipping ? 0 : shippingAmount);

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: '₫',
      decimalDigits: 0,
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppSpacing.borderRadiusMedium,
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header
          const Text(
            'Chi tiết thanh toán',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Subtotal row
          _SummaryRow(
            label: 'Tạm tính',
            value: formatter.format(subtotal),
            valueStyle: const TextStyle(
              fontSize: 14,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          // Discount row (if applicable)
          if (discountAmount > 0) ...[
            _SummaryRow(
              label: 'Giảm giá',
              value: '-${formatter.format(discountAmount)}',
              valueStyle: const TextStyle(
                fontSize: 14,
                color: AppColors.success,
                fontWeight: FontWeight.w500,
              ),
              valueIcon: Icons.discount_outlined,
              valueIconColor: AppColors.success,
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          // Shipping row
          _SummaryRow(
            label: 'Phí vận chuyển',
            value: isFreeShipping
                ? 'Miễn phí'
                : shippingAmount > 0
                    ? formatter.format(shippingAmount)
                    : 'Liên hệ sau',
            valueStyle: TextStyle(
              fontSize: 14,
              color: isFreeShipping ? AppColors.success : AppColors.onSurface,
              fontWeight: isFreeShipping ? FontWeight.w600 : FontWeight.normal,
            ),
            valueIcon: isFreeShipping ? Icons.local_shipping_outlined : null,
            valueIconColor: AppColors.success,
          ),
          if (shippingNote != null && !isFreeShipping) ...[
            const SizedBox(height: AppSpacing.xxs),
            Padding(
              padding: const EdgeInsets.only(left: 0),
              child: Text(
                shippingNote!,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.outline,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ],
          // Divider
          const SizedBox(height: AppSpacing.md),
          Divider(
            height: 1,
            color: AppColors.outlineVariant.withValues(alpha: 0.5),
          ),
          const SizedBox(height: AppSpacing.md),
          // Total row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Text(
                'Tổng cộng',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatter.format(total),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.priceCurrent,
                    ),
                  ),
                  if (discountAmount > 0) ...[
                    const SizedBox(height: 2),
                    Text(
                      '(Đã giảm ${formatter.format(discountAmount)})',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          // VAT note
          const SizedBox(height: AppSpacing.xs),
          Text(
            '(Giá đã bao gồm VAT)',
            style: TextStyle(
              fontSize: 11,
              color: AppColors.outline,
            ),
          ),
        ],
      ),
    );
  }
}

/// Individual row in the summary
class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueStyle,
    this.valueIcon,
    this.valueIconColor,
  });

  final String label;
  final String value;
  final TextStyle? valueStyle;
  final IconData? valueIcon;
  final Color? valueIconColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            color: AppColors.onSurfaceVariant,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (valueIcon != null) ...[
              Icon(
                valueIcon,
                size: 14,
                color: valueIconColor ?? AppColors.onSurfaceVariant,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              value,
              style: valueStyle ??
                  const TextStyle(
                    fontSize: 14,
                    color: AppColors.onSurface,
                  ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Skeleton loader for CartSummary
class CartSummarySkeleton extends StatelessWidget {
  const CartSummarySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppSpacing.borderRadiusMedium,
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header skeleton
          Container(
            height: 16,
            width: 120,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: AppSpacing.borderRadiusMicro,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Subtotal row skeleton
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                height: 14,
                width: 80,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: AppSpacing.borderRadiusMicro,
                ),
              ),
              Container(
                height: 14,
                width: 100,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: AppSpacing.borderRadiusMicro,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Shipping row skeleton
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                height: 14,
                width: 100,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: AppSpacing.borderRadiusMicro,
                ),
              ),
              Container(
                height: 14,
                width: 60,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: AppSpacing.borderRadiusMicro,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(
            height: 1,
            color: AppColors.outlineVariant.withValues(alpha: 0.5),
          ),
          const SizedBox(height: AppSpacing.md),
          // Total row skeleton
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                height: 16,
                width: 80,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: AppSpacing.borderRadiusMicro,
                ),
              ),
              Container(
                height: 20,
                width: 120,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: AppSpacing.borderRadiusMicro,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
