import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';

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

  final String? appliedCouponCode;
  final double? appliedCouponDiscount;
  final ValueChanged<String> onApply;
  final VoidCallback onRemove;
  final bool isLoading;
  final String? errorMessage;

  @override
  State<CouponSection> createState() => _CouponSectionState();
}

class _CouponSectionState extends State<CouponSection> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  bool get _hasAppliedCoupon => widget.appliedCouponCode != null;
  bool get _canApply =>
      !_hasAppliedCoupon &&
      !widget.isLoading &&
      _controller.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _controller.text = widget.appliedCouponCode ?? '';
  }

  @override
  void didUpdateWidget(CouponSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.appliedCouponCode != oldWidget.appliedCouponCode) {
      _controller.text = widget.appliedCouponCode ?? '';
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _apply() {
    if (!_canApply) return;
    widget.onApply(_controller.text.trim().toUpperCase());
    _focusNode.unfocus();
  }

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
          Row(
            children: [
              Icon(Icons.local_offer_outlined, color: colors.primary),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  localizations.couponTitle,
                  style: textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (_hasAppliedCoupon)
            _AppliedCoupon(
              code: widget.appliedCouponCode!,
              discount: widget.appliedCouponDiscount,
              isLoading: widget.isLoading,
              onRemove: widget.onRemove,
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final stackActions =
                    MediaQuery.textScalerOf(context).scale(1) >= 1.4 ||
                    constraints.maxWidth < 320;
                final input = TextField(
                  key: const Key('coupon-code-field'),
                  controller: _controller,
                  focusNode: _focusNode,
                  enabled: !widget.isLoading,
                  autocorrect: false,
                  textCapitalization: TextCapitalization.characters,
                  textInputAction: TextInputAction.done,
                  decoration: InputDecoration(
                    labelText: localizations.couponHint,
                    prefixIcon: const Icon(Icons.local_offer_outlined),
                    suffixIcon: _controller.text.isEmpty
                        ? null
                        : IconButton(
                            onPressed: () {
                              _controller.clear();
                              setState(() {});
                            },
                            tooltip: localizations.clearSearch,
                            icon: const Icon(Icons.clear),
                          ),
                  ),
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => _apply(),
                );
                final button = SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: _canApply ? _apply : null,
                    child: widget.isLoading
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(localizations.applyCoupon),
                  ),
                );

                if (stackActions) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      input,
                      const SizedBox(height: AppSpacing.sm),
                      button,
                    ],
                  );
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: input),
                    const SizedBox(width: AppSpacing.sm),
                    button,
                  ],
                );
              },
            ),
          if (widget.errorMessage != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Semantics(
              liveRegion: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.error_outline, size: 18, color: colors.error),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      widget.errorMessage!,
                      style: textTheme.bodySmall?.copyWith(color: colors.error),
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
}

class _AppliedCoupon extends StatelessWidget {
  const _AppliedCoupon({
    required this.code,
    required this.discount,
    required this.isLoading,
    required this.onRemove,
  });

  final String code;
  final double? discount;
  final bool isLoading;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle_outline, color: colors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.couponAppliedCode(code),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  discount != null && discount! > 0
                      ? '${localizations.couponApplied}: -${LocalizedFormatters.currency(context, discount!)}'
                      : localizations.couponApplied,
                  style: textTheme.bodySmall?.copyWith(
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (isLoading)
            const SizedBox.square(
              dimension: 48,
              child: Padding(
                padding: EdgeInsets.all(14),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            IconButton(
              onPressed: onRemove,
              tooltip: localizations.remove,
              icon: const Icon(Icons.close),
              constraints: const BoxConstraints.tightFor(width: 48, height: 48),
            ),
        ],
      ),
    );
  }
}
