import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/models/payment_transaction.dart';

/// Payment method selection card widget
class PaymentMethodCard extends StatelessWidget {
  final PaymentMethod method;
  final bool isSelected;
  final VoidCallback? onTap;

  const PaymentMethodCard({
    super.key,
    required this.method,
    this.isSelected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      elevation: isSelected ? 2 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        side: BorderSide(
          color: isSelected ? AppColors.primary : AppColors.outlineVariant,
          width: isSelected ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              // Selection indicator
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected ? AppColors.primary : AppColors.outline,
                    width: isSelected ? 2 : 1.5,
                  ),
                  color: isSelected ? AppColors.primary : Colors.transparent,
                ),
                child: isSelected
                    ? const Icon(
                        Icons.check,
                        size: 16,
                        color: AppColors.onPrimary,
                      )
                    : null,
              ),
              const SizedBox(width: AppSpacing.sm),

              // Payment icon
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: _getMethodColor(method).withAlpha(25),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
                ),
                child: Icon(
                  _getMethodIcon(method),
                  size: 24,
                  color: _getMethodColor(method),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),

              // Payment info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getMethodName(method),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _getMethodDescription(method),
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),

              // Selected indicator
              if (isSelected)
                Icon(
                  Icons.check_circle,
                  color: AppColors.primary,
                  size: 24,
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _getMethodName(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return 'VNPay';
      case PaymentMethod.momo:
        return 'MoMo';
      case PaymentMethod.vietqr:
        return 'VietQR';
      case PaymentMethod.cod:
        return 'Thanh toán khi nhận hàng';
      case PaymentMethod.bankTransfer:
        return 'Chuyển khoản ngân hàng';
    }
  }

  String _getMethodDescription(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return 'Thanh toán qua cổng VNPay';
      case PaymentMethod.momo:
        return 'Thanh toán qua ví MoMo';
      case PaymentMethod.vietqr:
        return 'Quét mã QR từ ứng dụng ngân hàng';
      case PaymentMethod.cod:
        return 'Trả tiền mặt khi nhận hàng';
      case PaymentMethod.bankTransfer:
        return 'Chuyển khoản trực tiếp qua ngân hàng';
    }
  }

  IconData _getMethodIcon(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return Icons.account_balance;
      case PaymentMethod.momo:
        return Icons.phone_android;
      case PaymentMethod.vietqr:
        return Icons.qr_code_2;
      case PaymentMethod.cod:
        return Icons.local_shipping_outlined;
      case PaymentMethod.bankTransfer:
        return Icons.account_balance_wallet;
    }
  }

  Color _getMethodColor(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return AppColors.vnpayBlue;
      case PaymentMethod.momo:
        return AppColors.momoPink;
      case PaymentMethod.vietqr:
        return AppColors.vietqrBlue;
      case PaymentMethod.cod:
        return AppColors.codOrange;
      case PaymentMethod.bankTransfer:
        return AppColors.bankGreen;
    }
  }
}

/// Payment method selector widget with all methods
class PaymentMethodSelector extends StatelessWidget {
  final PaymentMethod? selectedMethod;
  final ValueChanged<PaymentMethod> onMethodSelected;

  const PaymentMethodSelector({
    super.key,
    this.selectedMethod,
    required this.onMethodSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Text(
            'Phương thức thanh toán',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        PaymentMethodCard(
          method: PaymentMethod.vnpay,
          isSelected: selectedMethod == PaymentMethod.vnpay,
          onTap: () => onMethodSelected(PaymentMethod.vnpay),
        ),
        PaymentMethodCard(
          method: PaymentMethod.momo,
          isSelected: selectedMethod == PaymentMethod.momo,
          onTap: () => onMethodSelected(PaymentMethod.momo),
        ),
        PaymentMethodCard(
          method: PaymentMethod.vietqr,
          isSelected: selectedMethod == PaymentMethod.vietqr,
          onTap: () => onMethodSelected(PaymentMethod.vietqr),
        ),
        PaymentMethodCard(
          method: PaymentMethod.cod,
          isSelected: selectedMethod == PaymentMethod.cod,
          onTap: () => onMethodSelected(PaymentMethod.cod),
        ),
      ],
    );
  }
}
