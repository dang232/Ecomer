import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';

class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: ColoredBox(color: color)),
            const SizedBox(height: AppSpacing.sm),
            Container(height: 18, color: color),
            const SizedBox(height: AppSpacing.xs),
            FractionallySizedBox(
              widthFactor: 0.58,
              alignment: Alignment.centerLeft,
              child: Container(height: 16, color: color),
            ),
          ],
        ),
      ),
    );
  }
}
