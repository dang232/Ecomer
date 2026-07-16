import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';

class CartSummary extends StatelessWidget {
  const CartSummary({
    super.key,
    required this.subtotal,
    this.discountAmount = 0,
    this.showPromotionRecalculationNote = false,
  });

  final double subtotal;
  final double discountAmount;
  final bool showPromotionRecalculationNote;

  double get estimatedTotal => math.max(0, subtotal - discountAmount);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.outlineVariant),
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.orderSummary,
            style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.md),
          _SummaryRow(
            label: localizations.selectedSubtotal,
            value: LocalizedFormatters.currency(context, subtotal),
          ),
          if (discountAmount > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            _SummaryRow(
              label: localizations.discount,
              value:
                  '-${LocalizedFormatters.currency(context, discountAmount)}',
              valueColor: colors.primary,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          _SummaryRow(
            label: localizations.shipping,
            value: localizations.shippingCalculatedAtCheckout,
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(color: colors.outlineVariant),
          const SizedBox(height: AppSpacing.sm),
          _SummaryRow(
            label: localizations.estimatedTotal,
            value: LocalizedFormatters.currency(context, estimatedTotal),
            emphasize: true,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            localizations.vatIncluded,
            style: textTheme.bodySmall?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
          if (showPromotionRecalculationNote) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 18, color: colors.primary),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    localizations.discountRecalculatedAtCheckout,
                    style: textTheme.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: emphasize
                ? textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)
                : textTheme.bodyMedium,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: emphasize
                ? textTheme.titleMedium?.copyWith(
                    color: valueColor ?? Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w800,
                  )
                : textTheme.bodyMedium?.copyWith(
                    color: valueColor,
                    fontWeight: valueColor == null
                        ? FontWeight.w500
                        : FontWeight.w700,
                  ),
          ),
        ),
      ],
    );
  }
}

class CartSummarySkeleton extends StatelessWidget {
  const CartSummarySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Bar(width: 128, color: color),
          const SizedBox(height: AppSpacing.md),
          _Bar(color: color),
          const SizedBox(height: AppSpacing.sm),
          _Bar(color: color),
          const SizedBox(height: AppSpacing.md),
          _Bar(width: 180, height: 22, color: color),
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    this.width = double.infinity,
    this.height = 16,
    required this.color,
  });

  final double width;
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
    );
  }
}
