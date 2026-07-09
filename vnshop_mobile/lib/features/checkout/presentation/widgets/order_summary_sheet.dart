import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../cart/data/models/cart_item_model.dart';

/// Collapsible order summary sheet widget
class OrderSummarySheet extends StatefulWidget {
  final List<CartItemModel> cartItems;
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final String? couponCode;

  const OrderSummarySheet({
    super.key,
    required this.cartItems,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    this.couponCode,
  });

  @override
  State<OrderSummarySheet> createState() => _OrderSummarySheetState();
}

class _OrderSummarySheetState extends State<OrderSummarySheet> {
  bool _isExpanded = false;

  int get _itemCount => widget.cartItems.fold(
        0,
        (sum, item) => sum + item.quantity,
      );

  double get _totalAmount =>
      widget.subtotal + widget.shippingFee - widget.discountAmount;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        border: Border.all(color: AppColors.outlineVariant),
      ),
      child: Column(
        children: [
          // Header (always visible)
          InkWell(
            onTap: () {
              setState(() => _isExpanded = !_isExpanded);
            },
            borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(25),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
                    ),
                    child: const Icon(
                      Icons.receipt_long_outlined,
                      size: 20,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Tóm tắt đơn hàng',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '$_itemCount sản phẩm',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    CurrencyFormatter.format(_totalAmount.toInt()),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  AnimatedRotation(
                    turns: _isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(
                      Icons.keyboard_arrow_down,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Expanded content
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 200),
            crossFadeState: _isExpanded
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            firstChild: _ExpandedContent(
              cartItems: widget.cartItems,
              subtotal: widget.subtotal,
              shippingFee: widget.shippingFee,
              discountAmount: widget.discountAmount,
              couponCode: widget.couponCode,
              totalAmount: _totalAmount,
            ),
            secondChild: const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

/// Expanded content with product list and price breakdown
class _ExpandedContent extends StatelessWidget {
  final List<CartItemModel> cartItems;
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final String? couponCode;
  final double totalAmount;

  const _ExpandedContent({
    required this.cartItems,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    this.couponCode,
    required this.totalAmount,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Divider(height: 1),

        // Product list
        Container(
          constraints: const BoxConstraints(maxHeight: 200),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const ClampingScrollPhysics(),
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            itemCount: cartItems.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = cartItems[index];
              return _ProductItem(item: item);
            },
          ),
        ),

        const Divider(height: 1),

        // Price breakdown
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            children: [
              _PriceRow(
                label: 'Tạm tính',
                value: CurrencyFormatter.format(subtotal.toInt()),
              ),
              const SizedBox(height: AppSpacing.xs),
              _PriceRow(
                label: 'Phí vận chuyển',
                value: shippingFee > 0
                    ? CurrencyFormatter.format(shippingFee.toInt())
                    : 'Đang tính...',
                valueColor: shippingFee > 0 ? null : AppColors.onSurfaceVariant,
              ),
              if (discountAmount > 0) ...[
                const SizedBox(height: AppSpacing.xs),
                _PriceRow(
                  label: 'Giảm giá',
                  value: '-${CurrencyFormatter.format(discountAmount.toInt())}',
                  valueColor: AppColors.success,
                  suffix: couponCode != null ? ' ($couponCode)' : null,
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              const Divider(height: 1),
              const SizedBox(height: AppSpacing.sm),
              _PriceRow(
                label: 'Tổng cộng',
                value: CurrencyFormatter.format(totalAmount.toInt()),
                isTotal: true,
              ),
            ],
          ),
        ),

        // Free shipping promotion
        if (totalAmount >= 500000 && discountAmount == 0) ...[
          Container(
            margin: const EdgeInsets.only(
              left: AppSpacing.md,
              right: AppSpacing.md,
              bottom: AppSpacing.md,
            ),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.info.withAlpha(25),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
              border: Border.all(color: AppColors.info.withAlpha(77)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.local_shipping_outlined,
                  size: 18,
                  color: AppColors.info,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    'Đơn hàng trên 500.000₫ được miễn phí vận chuyển!',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.info,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Individual product item in the list
class _ProductItem extends StatelessWidget {
  final CartItemModel item;

  const _ProductItem({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      child: Row(
        children: [
          // Product image
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
            ),
            child: item.imageUrl != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
                    child: Image.network(
                      item.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.image_outlined,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.image_outlined,
                    color: AppColors.onSurfaceVariant,
                  ),
          ),
          const SizedBox(width: AppSpacing.sm),

          // Product info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item.optionName != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.optionName!,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Quantity and price
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                CurrencyFormatter.format(item.totalPrice.toInt()),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                'x${item.quantity}',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Price row widget
class _PriceRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isTotal;
  final Color? valueColor;
  final String? suffix;

  const _PriceRow({
    required this.label,
    required this.value,
    this.isTotal = false,
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
            fontSize: isTotal ? 15 : 14,
            fontWeight: isTotal ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (suffix != null)
              Text(
                suffix!,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            const SizedBox(width: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: isTotal ? 16 : 14,
                fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
                color: valueColor ??
                    (isTotal ? AppColors.primary : null),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
