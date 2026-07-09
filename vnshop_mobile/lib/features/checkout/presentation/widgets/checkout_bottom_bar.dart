import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/currency_formatter.dart';
import '../../../../common/widgets/buttons/vn_button.dart';
import '../../data/models/payment_transaction.dart';

/// Sticky bottom bar for checkout with total and place order button
class CheckoutBottomBar extends StatelessWidget {
  final double totalAmount;
  final bool isEnabled;
  final bool isLoading;
  final PaymentMethod? paymentMethod;
  final VoidCallback onPlaceOrder;

  const CheckoutBottomBar({
    super.key,
    required this.totalAmount,
    required this.isEnabled,
    this.isLoading = false,
    this.paymentMethod,
    required this.onPlaceOrder,
  });

  String get _buttonLabel {
    if (paymentMethod == PaymentMethod.cod) {
      return 'Đặt hàng ngay';
    } else if (paymentMethod != null) {
      return 'Thanh toán ngay';
    }
    return 'Đặt hàng ngay';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Total amount
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tổng cộng',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    CurrencyFormatter.format(totalAmount.toInt()),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(width: AppSpacing.md),

            // Place order button
            SizedBox(
              width: 180,
              child: VnPrimaryButton(
                onPressed: isEnabled && !isLoading ? onPlaceOrder : null,
                label: _buttonLabel,
                isLoading: isLoading,
                height: 52,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Alternative checkout bottom bar with more detailed information
class CheckoutBottomBarDetailed extends StatelessWidget {
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final bool isEnabled;
  final bool isLoading;
  final PaymentMethod? paymentMethod;
  final VoidCallback onPlaceOrder;

  const CheckoutBottomBarDetailed({
    super.key,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.isEnabled,
    this.isLoading = false,
    this.paymentMethod,
    required this.onPlaceOrder,
  });

  double get _totalAmount => subtotal + shippingFee - discountAmount;

  String get _buttonLabel {
    if (paymentMethod == PaymentMethod.cod) {
      return 'Đặt hàng ngay';
    } else if (paymentMethod != null) {
      return 'Thanh toán ngay';
    }
    return 'Đặt hàng ngay';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Price breakdown (collapsible)
            _PriceBreakdownRow(
              subtotal: subtotal,
              shippingFee: shippingFee,
              discountAmount: discountAmount,
              totalAmount: _totalAmount,
            ),

            const SizedBox(height: AppSpacing.sm),

            // Button row
            Row(
              children: [
                // Total amount
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tổng cộng',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        CurrencyFormatter.format(_totalAmount.toInt()),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: AppSpacing.md),

                // Place order button
                SizedBox(
                  width: 180,
                  child: VnPrimaryButton(
                    onPressed: isEnabled && !isLoading ? onPlaceOrder : null,
                    label: _buttonLabel,
                    isLoading: isLoading,
                    height: 52,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Collapsible price breakdown row
class _PriceBreakdownRow extends StatefulWidget {
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final double totalAmount;

  const _PriceBreakdownRow({
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.totalAmount,
  });

  @override
  State<_PriceBreakdownRow> createState() => _PriceBreakdownRowState();
}

class _PriceBreakdownRowState extends State<_PriceBreakdownRow> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: () => setState(() => _isExpanded = !_isExpanded),
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: AppSpacing.xs,
              horizontal: AppSpacing.xs,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Chi tiết giá',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(width: 4),
                AnimatedRotation(
                  turns: _isExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(
                    Icons.keyboard_arrow_down,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState: _isExpanded
              ? CrossFadeState.showFirst
              : CrossFadeState.showSecond,
          firstChild: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Column(
              children: [
                _BreakdownItem(
                  label: 'Tạm tính',
                  value: CurrencyFormatter.format(widget.subtotal.toInt()),
                ),
                _BreakdownItem(
                  label: 'Phí vận chuyển',
                  value: widget.shippingFee > 0
                      ? CurrencyFormatter.format(widget.shippingFee.toInt())
                      : 'Miễn phí',
                ),
                if (widget.discountAmount > 0)
                  _BreakdownItem(
                    label: 'Giảm giá',
                    value: '-${CurrencyFormatter.format(widget.discountAmount.toInt())}',
                    valueColor: AppColors.success,
                  ),
              ],
            ),
          ),
          secondChild: const SizedBox.shrink(),
        ),
      ],
    );
  }
}

/// Breakdown item widget
class _BreakdownItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _BreakdownItem({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.onSurfaceVariant,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              color: valueColor ?? AppColors.onSurface,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
