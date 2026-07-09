import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/models/order_model.dart';

/// Visual stepper showing order status progression
/// Steps: Đặt hàng → Xác nhận → Đang giao → Đã giao
class OrderStatusStepper extends StatelessWidget {
  final OrderStatus currentStatus;

  const OrderStatusStepper({
    super.key,
    required this.currentStatus,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.lg),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        children: [
          // Step indicators row
          Row(
            children: [
              _buildStep(
                context,
                index: 0,
                icon: Icons.shopping_cart_outlined,
                label: 'Đặt hàng',
                isCompleted: _isStepCompleted(0),
                isActive: _isStepActive(0),
              ),
              _buildConnector(
                context,
                isCompleted: _isStepCompleted(0) && _isStepCompleted(1),
              ),
              _buildStep(
                context,
                index: 1,
                icon: Icons.check_circle_outline,
                label: 'Xác nhận',
                isCompleted: _isStepCompleted(1),
                isActive: _isStepActive(1),
              ),
              _buildConnector(
                context,
                isCompleted: _isStepCompleted(1) && _isStepCompleted(2),
              ),
              _buildStep(
                context,
                index: 2,
                icon: Icons.local_shipping_outlined,
                label: 'Đang giao',
                isCompleted: _isStepCompleted(2),
                isActive: _isStepActive(2),
              ),
              _buildConnector(
                context,
                isCompleted: _isStepCompleted(2) && _isStepCompleted(3),
              ),
              _buildStep(
                context,
                index: 3,
                icon: Icons.home_outlined,
                label: 'Đã giao',
                isCompleted: _isStepCompleted(3),
                isActive: _isStepActive(3),
              ),
            ],
          ),
          // Cancelled state
          if (currentStatus == OrderStatus.cancelled) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.errorContainer,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.cancel_outlined,
                    color: AppColors.error,
                    size: 20,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Đơn hàng đã bị hủy',
                    style: TextStyle(
                      color: AppColors.error,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  int _getStepIndex(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return 0;
      case OrderStatus.confirmed:
      case OrderStatus.processing:
        return 1;
      case OrderStatus.shipped:
        return 2;
      case OrderStatus.delivered:
        return 3;
      case OrderStatus.cancelled:
        return -1;
    }
  }

  int get _currentStepIndex => _getStepIndex(currentStatus);

  bool _isStepCompleted(int stepIndex) {
    if (currentStatus == OrderStatus.cancelled) return false;
    return stepIndex < _currentStepIndex;
  }

  bool _isStepActive(int stepIndex) {
    if (currentStatus == OrderStatus.cancelled) return false;
    return stepIndex == _currentStepIndex;
  }

  Widget _buildStep(
    BuildContext context, {
    required int index,
    required IconData icon,
    required String label,
    required bool isCompleted,
    required bool isActive,
  }) {
    final primaryColor = Theme.of(context).colorScheme.primary;
    final successColor = AppColors.success;

    Color backgroundColor;
    Color iconColor;
    Color textColor;

    if (isCompleted) {
      backgroundColor = successColor;
      iconColor = AppColors.onSuccess;
      textColor = successColor;
    } else if (isActive) {
      backgroundColor = primaryColor;
      iconColor = AppColors.onPrimary;
      textColor = primaryColor;
    } else {
      backgroundColor = Theme.of(context).colorScheme.surfaceContainerHighest;
      iconColor = Theme.of(context).colorScheme.onSurfaceVariant;
      textColor = Theme.of(context).colorScheme.onSurfaceVariant;
    }

    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: backgroundColor,
              shape: BoxShape.circle,
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.3),
                        blurRadius: 8,
                        spreadRadius: 2,
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: isCompleted
                  ? Icon(
                      Icons.check,
                      color: AppColors.onSuccess,
                      size: 20,
                    )
                  : Icon(
                      icon,
                      color: iconColor,
                      size: 20,
                    ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isActive || isCompleted ? FontWeight.w600 : FontWeight.normal,
              color: textColor,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildConnector(BuildContext context, {required bool isCompleted}) {
    final primaryColor = Theme.of(context).colorScheme.primary;
    final successColor = AppColors.success;
    final connectorColor = isCompleted ? successColor : Theme.of(context).colorScheme.outlineVariant;

    return Expanded(
      child: Container(
        height: 3,
        margin: const EdgeInsets.only(bottom: 24),
        decoration: BoxDecoration(
          color: connectorColor,
          borderRadius: BorderRadius.circular(2),
        ),
        child: isCompleted
            ? LayoutBuilder(
                builder: (context, constraints) {
                  return Stack(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        width: constraints.maxWidth,
                        height: 3,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [primaryColor, successColor],
                          ),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ],
                  );
                },
              )
            : null,
      ),
    );
  }
}

/// Compact horizontal stepper for use in cards
class OrderStatusStepperCompact extends StatelessWidget {
  final OrderStatus currentStatus;

  const OrderStatusStepperCompact({
    super.key,
    required this.currentStatus,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildDot(context, isCompleted: true, isActive: false),
        _buildLine(context, 0),
        _buildDot(context, isCompleted: _isStepCompleted(1), isActive: _isStepActive(1)),
        _buildLine(context, 1),
        _buildDot(context, isCompleted: _isStepCompleted(2), isActive: _isStepActive(2)),
        _buildLine(context, 2),
        _buildDot(context, isCompleted: _isStepCompleted(3), isActive: _isStepActive(3)),
      ],
    );
  }

  int _getStepIndex(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return 0;
      case OrderStatus.confirmed:
      case OrderStatus.processing:
        return 1;
      case OrderStatus.shipped:
        return 2;
      case OrderStatus.delivered:
        return 3;
      case OrderStatus.cancelled:
        return -1;
    }
  }

  int get _currentStepIndex => _getStepIndex(currentStatus);

  bool _isStepCompleted(int stepIndex) {
    if (currentStatus == OrderStatus.cancelled) return false;
    return stepIndex < _currentStepIndex;
  }

  bool _isStepActive(int stepIndex) {
    if (currentStatus == OrderStatus.cancelled) return false;
    return stepIndex == _currentStepIndex;
  }

  Widget _buildDot(
    BuildContext context, {
    required bool isCompleted,
    required bool isActive,
  }) {
    final primaryColor = Theme.of(context).colorScheme.primary;
    final successColor = AppColors.success;

    Color dotColor;
    if (isCompleted) {
      dotColor = successColor;
    } else if (isActive) {
      dotColor = primaryColor;
    } else {
      dotColor = Theme.of(context).colorScheme.surfaceContainerHighest;
    }

    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: dotColor,
        shape: BoxShape.circle,
      ),
    );
  }

  Widget _buildLine(BuildContext context, int beforeStep) {
    final isCompleted = _isStepCompleted(beforeStep + 1);
    return Container(
      width: 20,
      height: 2,
      color: isCompleted ? AppColors.success : Theme.of(context).colorScheme.surfaceContainerHighest,
    );
  }
}
