import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/shipping_quote.dart';
import '../mappers/checkout_presentation_mapper.dart';

class ShippingMethodCard extends StatelessWidget {
  const ShippingMethodCard({
    super.key,
    required this.shipping,
    this.isSelected = false,
    this.onTap,
  });

  final ShippingQuote shipping;
  final bool isSelected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final localizations = AppLocalizations.of(context);
    final enabled = shipping.isAvailable && onTap != null;
    final price = shipping.price == 0
        ? localizations.free
        : LocalizedFormatters.currency(context, shipping.price);

    return Semantics(
      selected: isSelected,
      enabled: enabled,
      button: enabled,
      child: Card(
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        shape: RoundedRectangleBorder(
          borderRadius: AppSpacing.borderRadiusSmall,
          side: BorderSide(
            color: isSelected ? colors.primary : colors.outlineVariant,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: AppSpacing.borderRadiusSmall,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox.square(
                  dimension: 48,
                  child: Radio<ShippingQuote>(
                    value: shipping,
                    enabled: enabled,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: colors.primaryContainer,
                    borderRadius: AppSpacing.borderRadiusSmall,
                  ),
                  child: Icon(
                    shipping.provider.icon,
                    color: colors.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.xs,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.xxs,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              shipping.name,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              price,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(
                                    color: shipping.price == 0
                                        ? colors.tertiary
                                        : colors.primary,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                        ),
                        if (shipping.description.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            shipping.description,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: colors.onSurfaceVariant),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.xs),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.schedule_outlined,
                              size: 18,
                              color: colors.tertiary,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                shipping.localizedEstimate(localizations),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: colors.tertiary,
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ShippingMethodCardSkeleton extends StatelessWidget {
  const ShippingMethodCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SkeletonBox(width: 48, height: 48, color: color),
            const SizedBox(width: AppSpacing.xs),
            _SkeletonBox(width: 48, height: 48, color: color),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SkeletonBox(width: 160, height: 16, color: color),
                  const SizedBox(height: AppSpacing.xs),
                  _SkeletonBox(height: 14, color: color),
                  const SizedBox(height: AppSpacing.xs),
                  _SkeletonBox(width: 120, height: 14, color: color),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    this.width = double.infinity,
    required this.height,
    required this.color,
  });

  final double width;
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
    );
  }
}
