import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// Payment trust signals widget - displays security badges and trust indicators
class PaymentTrustSignals extends StatelessWidget {
  const PaymentTrustSignals({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.success.withAlpha(15),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        border: Border.all(
          color: AppColors.success.withAlpha(50),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.verified_user_outlined,
                size: 18,
                color: AppColors.success,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                'Thanh toán an toàn',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.success,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.sm,
            children: const [
              _TrustBadge(
                icon: Icons.lock_outlined,
                label: '256-bit SSL',
              ),
              _TrustBadge(
                icon: Icons.verified_outlined,
                label: 'VNPay Verified',
              ),
              _TrustBadge(
                icon: Icons.security_outlined,
                label: 'PCI Compliant',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Thông tin thanh toán được mã hóa và bảo mật tuyệt đối',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _TrustBadge extends StatelessWidget {
  final IconData icon;
  final String label;

  const _TrustBadge({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 14,
          color: AppColors.primary,
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: AppColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// Quick info chip for payment methods
class PaymentMethodInfoChip extends StatelessWidget {
  final PaymentMethodInfo info;

  const PaymentMethodInfoChip({super.key, required this.info});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: info.backgroundColor.withAlpha(25),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            info.icon,
            size: 14,
            color: info.iconColor,
          ),
          const SizedBox(width: 4),
          Text(
            info.label,
            style: TextStyle(
              fontSize: 11,
              color: info.iconColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/// Info for specific payment methods
class PaymentMethodInfo {
  final IconData icon;
  final String label;
  final Color iconColor;
  final Color backgroundColor;

  const PaymentMethodInfo._({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.backgroundColor,
  });

  static const cod = PaymentMethodInfo._(
    icon: Icons.shield_outlined,
    label: 'Không phí',
    iconColor: AppColors.codOrange,
    backgroundColor: AppColors.codOrange,
  );

  static const vietqr = PaymentMethodInfo._(
    icon: Icons.qr_code,
    label: '0đ phí',
    iconColor: AppColors.vietqrBlue,
    backgroundColor: AppColors.vietqrBlue,
  );

  static const momo = PaymentMethodInfo._(
    icon: Icons.flash_on,
    label: 'Thanh toán nhanh',
    iconColor: AppColors.momoPink,
    backgroundColor: AppColors.momoPink,
  );

  static const vnpay = PaymentMethodInfo._(
    icon: Icons.bolt,
    label: 'Bảo mật',
    iconColor: AppColors.vnpayBlue,
    backgroundColor: AppColors.vnpayBlue,
  );
}
