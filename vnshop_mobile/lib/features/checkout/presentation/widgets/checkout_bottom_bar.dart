import 'package:flutter/material.dart';

import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/payment_transaction.dart';

class CheckoutBottomBar extends StatelessWidget {
  const CheckoutBottomBar({
    super.key,
    required this.totalAmount,
    required this.isEnabled,
    required this.onPlaceOrder,
    this.isLoading = false,
    this.paymentMethod,
  });

  final double totalAmount;
  final bool isEnabled;
  final bool isLoading;
  final PaymentMethod? paymentMethod;
  final VoidCallback onPlaceOrder;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final actionLabel =
        paymentMethod == null || paymentMethod == PaymentMethod.cod
        ? localizations.placeOrder
        : localizations.payNow;

    return Material(
      color: colors.surface,
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: colors.outlineVariant)),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final textScale = MediaQuery.textScalerOf(context).scale(1);
              final useStackedLayout =
                  constraints.maxWidth < 420 || textScale > 1.3;
              final total = _TotalAmount(
                label: localizations.total,
                value: LocalizedFormatters.currency(context, totalAmount),
              );
              final action = VnPrimaryButton(
                onPressed: isEnabled && !isLoading ? onPlaceOrder : null,
                label: actionLabel,
                isLoading: isLoading,
              );

              if (useStackedLayout) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    total,
                    const SizedBox(height: AppSpacing.sm),
                    action,
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(flex: 4, child: total),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(flex: 5, child: action),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _TotalAmount extends StatelessWidget {
  const _TotalAmount({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.xxs),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: theme.textTheme.titleLarge?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}
