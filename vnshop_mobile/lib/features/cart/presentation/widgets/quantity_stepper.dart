import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';

class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onChanged,
    this.minValue = 1,
    this.maxValue = 99,
    this.enabled = true,
  });

  final int quantity;
  final ValueChanged<int> onChanged;
  final int minValue;
  final int maxValue;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final canDecrement = enabled && quantity > minValue;
    final canIncrement = enabled && quantity < maxValue;

    return Semantics(
      label: localizations.quantityValue(quantity),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: colors.outlineVariant),
          borderRadius: AppSpacing.borderRadiusSmall,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              key: const Key('decrease-cart-quantity'),
              onPressed: canDecrement ? () => onChanged(quantity - 1) : null,
              tooltip: localizations.decreaseQuantity,
              icon: const Icon(Icons.remove),
              constraints: const BoxConstraints.tightFor(width: 48, height: 48),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 40, minHeight: 48),
              child: Center(
                child: Text(
                  '$quantity',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ),
            IconButton(
              key: const Key('increase-cart-quantity'),
              onPressed: canIncrement ? () => onChanged(quantity + 1) : null,
              tooltip: localizations.increaseQuantity,
              icon: const Icon(Icons.add),
              constraints: const BoxConstraints.tightFor(width: 48, height: 48),
            ),
          ],
        ),
      ),
    );
  }
}
