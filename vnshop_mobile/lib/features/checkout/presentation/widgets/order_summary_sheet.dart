import 'package:flutter/material.dart';

import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../cart/data/models/cart_item_model.dart';

class OrderSummarySheet extends StatelessWidget {
  const OrderSummarySheet({
    super.key,
    required this.cartItems,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.isShippingCalculated,
    this.couponCode,
  });

  final List<CartItemModel> cartItems;
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final bool isShippingCalculated;
  final String? couponCode;

  int get _itemCount =>
      cartItems.fold(0, (total, item) => total + item.quantity);

  double get _totalAmount => subtotal + shippingFee - discountAmount;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          localizations.cartItemCount(_itemCount),
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (var index = 0; index < cartItems.length; index++) ...[
          _ProductSummaryRow(item: cartItems[index]),
          if (index != cartItems.length - 1)
            const Divider(height: AppSpacing.lg),
        ],
        const SizedBox(height: AppSpacing.md),
        const Divider(),
        const SizedBox(height: AppSpacing.xs),
        _PriceRow(
          label: localizations.subtotal,
          value: LocalizedFormatters.currency(context, subtotal),
        ),
        const SizedBox(height: AppSpacing.xs),
        _PriceRow(
          label: localizations.shipping,
          value: isShippingCalculated
              ? shippingFee == 0
                    ? localizations.free
                    : LocalizedFormatters.currency(context, shippingFee)
              : localizations.shippingCalculatedAtCheckout,
        ),
        if (discountAmount > 0) ...[
          const SizedBox(height: AppSpacing.xs),
          _PriceRow(
            label: couponCode == null
                ? localizations.discount
                : '${localizations.discount} ($couponCode)',
            value: '-${LocalizedFormatters.currency(context, discountAmount)}',
            valueColor: colors.tertiary,
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        const Divider(),
        const SizedBox(height: AppSpacing.xs),
        _PriceRow(
          label: localizations.total,
          value: LocalizedFormatters.currency(context, _totalAmount),
          isTotal: true,
        ),
      ],
    );
  }
}

class _ProductSummaryRow extends StatelessWidget {
  const _ProductSummaryRow({required this.item});

  final CartItemModel item;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final localizations = AppLocalizations.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SafeNetworkImage(
          url: item.imageUrl,
          width: 56,
          height: 56,
          borderRadius: AppSpacing.borderRadiusSmall,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.name,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
              if (item.optionName?.isNotEmpty ?? false) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  item.optionName!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.xxs,
                children: [
                  Text(
                    localizations.cartItemCount(item.quantity),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    LocalizedFormatters.currency(context, item.totalPrice),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.isTotal = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool isTotal;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = isTotal
        ? theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)
        : theme.textTheme.bodyMedium;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: style)),
        const SizedBox(width: AppSpacing.md),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: style?.copyWith(
              color: valueColor ?? (isTotal ? theme.colorScheme.primary : null),
              fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
