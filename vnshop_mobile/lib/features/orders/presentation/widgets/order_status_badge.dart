import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/order_model.dart';
import '../mappers/order_presentation_mapper.dart';

class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({required this.status, this.large = false, super.key});

  final OrderStatus status;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final color = status.color;
    final label = status.localizedLabel(localizations);

    return Semantics(
      label: label,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: large ? AppSpacing.sm : AppSpacing.xs,
          vertical: large ? AppSpacing.xs : AppSpacing.xxs,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: AppSpacing.borderRadiusSmall,
          border: Border.all(color: color.withValues(alpha: 0.28)),
        ),
        child: Wrap(
          spacing: AppSpacing.xxs,
          runSpacing: AppSpacing.xxs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Icon(status.icon, size: large ? 20 : 16, color: color),
            Text(
              label,
              style:
                  (large
                          ? Theme.of(context).textTheme.labelLarge
                          : Theme.of(context).textTheme.labelMedium)
                      ?.copyWith(color: color, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
