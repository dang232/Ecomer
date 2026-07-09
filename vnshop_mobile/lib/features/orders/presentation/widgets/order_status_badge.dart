import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/models/order_model.dart';

class OrderStatusBadge extends StatelessWidget {
  final OrderStatus status;
  final bool large;

  const OrderStatusBadge({
    super.key,
    required this.status,
    this.large = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: large ? AppSpacing.sm : AppSpacing.xs,
        vertical: large ? 6 : AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: _getBackgroundColor(),
        borderRadius: BorderRadius.circular(large ? AppSpacing.radiusSmall : AppSpacing.radiusMicro),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          color: _getTextColor(),
          fontSize: large ? 14 : 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Color _getBackgroundColor() {
    switch (status) {
      case OrderStatus.pending:
        return const Color(0xFFFFF3E0); // Orange 50
      case OrderStatus.confirmed:
        return const Color(0xFFE3F2FD); // Blue 50
      case OrderStatus.processing:
        return const Color(0xFFF3E5F5); // Purple 50
      case OrderStatus.shipped:
        return const Color(0xFFE1F5FE); // Light Blue 50
      case OrderStatus.delivered:
        return const Color(0xFFE8F5E9); // Green 50
      case OrderStatus.cancelled:
        return const Color(0xFFFFEBEE); // Red 50
    }
  }

  Color _getTextColor() {
    switch (status) {
      case OrderStatus.pending:
        return const Color(0xFFE65100); // Orange 900
      case OrderStatus.confirmed:
        return const Color(0xFF1565C0); // Blue 800
      case OrderStatus.processing:
        return const Color(0xFF7B1FA2); // Purple 700
      case OrderStatus.shipped:
        return const Color(0xFF0288D1); // Light Blue 700
      case OrderStatus.delivered:
        return AppColors.success;
      case OrderStatus.cancelled:
        return AppColors.error;
    }
  }
}

class OrderStatusChip extends StatelessWidget {
  final OrderStatus? status;
  final String label;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;

  const OrderStatusChip({
    super.key,
    this.status,
    required this.label,
    this.count = 0,
    this.isSelected = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.outline.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? Colors.white
                    : Theme.of(context).colorScheme.onSurface,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.2)
                      : Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: TextStyle(
                    color: isSelected
                        ? Colors.white
                        : Theme.of(context).colorScheme.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
