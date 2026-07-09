import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// Coupon input section for cart with text field, apply button,
/// applied coupon badge, and remove functionality.
class CouponSection extends StatefulWidget {
  const CouponSection({
    super.key,
    this.appliedCouponCode,
    this.appliedCouponDiscount,
    required this.onApply,
    required this.onRemove,
    this.isLoading = false,
    this.errorMessage,
  });

  /// Currently applied coupon code
  final String? appliedCouponCode;

  /// Discount amount from applied coupon
  final double? appliedCouponDiscount;

  /// Callback when coupon is applied
  final ValueChanged<String> onApply;

  /// Callback when coupon is removed
  final VoidCallback onRemove;

  /// Whether an async operation is in progress
  final bool isLoading;

  /// Error message to display
  final String? errorMessage;

  @override
  State<CouponSection> createState() => _CouponSectionState();
}

class _CouponSectionState extends State<CouponSection> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  bool get _hasAppliedCoupon => widget.appliedCouponCode != null;

  @override
  void initState() {
    super.initState();
    if (widget.appliedCouponCode != null) {
      _controller.text = widget.appliedCouponCode!;
    }
  }

  @override
  void didUpdateWidget(CouponSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Update controller if coupon changed externally
    if (widget.appliedCouponCode != oldWidget.appliedCouponCode &&
        widget.appliedCouponCode != null) {
      _controller.text = widget.appliedCouponCode!;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleApply() {
    final code = _controller.text.trim().toUpperCase();
    if (code.isNotEmpty) {
      widget.onApply(code);
      _focusNode.unfocus();
    }
  }

  void _handleClear() {
    _controller.clear();
    setState(() {});
  }

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
          // Section header
          Row(
            children: [
              const Icon(
                Icons.local_offer_outlined,
                size: 20,
                color: AppColors.primary,
              ),
              const SizedBox(width: AppSpacing.xs),
              const Text(
                'Mã giảm giá',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Input field and apply button
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  enabled: !_hasAppliedCoupon && !widget.isLoading,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'Nhập mã giảm giá',
                    hintStyle: TextStyle(
                      color: AppColors.outline,
                      fontSize: 14,
                    ),
                    prefixIcon: const Icon(
                      Icons.local_offer_outlined,
                      size: 20,
                      color: AppColors.outline,
                    ),
                    suffixIcon: _controller.text.isNotEmpty && !_hasAppliedCoupon
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: _handleClear,
                            color: AppColors.outline,
                          )
                        : null,
                    filled: true,
                    fillColor: AppColors.surfaceVariant.withValues(alpha: 0.5),
                    border: OutlineInputBorder(
                      borderRadius: AppSpacing.borderRadiusSmall,
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: AppSpacing.borderRadiusSmall,
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: AppSpacing.borderRadiusSmall,
                      borderSide: const BorderSide(
                        color: AppColors.primary,
                        width: 1.5,
                      ),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm,
                    ),
                  ),
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => _handleApply(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              SizedBox(
                height: 48,
                child: _buildActionButton(),
              ),
            ],
          ),
          // Error message
          if (widget.errorMessage != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 14,
                  color: AppColors.error,
                ),
                const SizedBox(width: AppSpacing.xxs),
                Expanded(
                  child: Text(
                    widget.errorMessage!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.error,
                    ),
                  ),
                ),
              ],
            ),
          ],
          // Applied coupon badge
          if (_hasAppliedCoupon) ...[
            const SizedBox(height: AppSpacing.sm),
            _buildAppliedCouponBadge(),
          ],
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    if (widget.isLoading) {
      return Container(
        width: 100,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: AppSpacing.borderRadiusSmall,
        ),
        child: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.primary,
          ),
        ),
      );
    }

    if (_hasAppliedCoupon) {
      return OutlinedButton(
        onPressed: widget.onRemove,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.error,
          side: const BorderSide(color: AppColors.error),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          shape: RoundedRectangleBorder(
            borderRadius: AppSpacing.borderRadiusSmall,
          ),
        ),
        child: const Text(
          'Xóa',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    final canApply = _controller.text.trim().isNotEmpty;
    return FilledButton(
      onPressed: canApply ? _handleApply : null,
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        disabledBackgroundColor: AppColors.surfaceVariant,
        foregroundColor: AppColors.onPrimary,
        disabledForegroundColor: AppColors.outline,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        shape: RoundedRectangleBorder(
          borderRadius: AppSpacing.borderRadiusSmall,
        ),
      ),
      child: const Text(
        'Áp dụng',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildAppliedCouponBadge() {
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: '₫',
      decimalDigits: 0,
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: AppSpacing.borderRadiusSmall,
        border: Border.all(
          color: AppColors.success.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check,
              size: 14,
              color: AppColors.success,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Mã: ${widget.appliedCouponCode}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.success,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Đã áp dụng',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.onSuccess,
                        ),
                      ),
                    ),
                  ],
                ),
                if (widget.appliedCouponDiscount != null &&
                    widget.appliedCouponDiscount! > 0) ...[
                  const SizedBox(height: 2),
                  Text(
                    '-${formatter.format(widget.appliedCouponDiscount)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
