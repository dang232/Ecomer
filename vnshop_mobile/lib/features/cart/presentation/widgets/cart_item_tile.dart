import 'package:flutter/material.dart';

import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/cart_item_model.dart';
import 'quantity_stepper.dart';

class CartItemTile extends StatelessWidget {
  const CartItemTile({
    super.key,
    required this.item,
    required this.onQuantityChanged,
    required this.onRemove,
    this.isSelected = false,
    this.onSelectionChanged,
    this.isLoading = false,
    this.hasDiscount = false,
    this.originalPrice,
  });

  final CartItemModel item;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onRemove;
  final bool isSelected;
  final ValueChanged<bool>? onSelectionChanged;
  final bool isLoading;
  final bool hasDiscount;
  final double? originalPrice;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Dismissible(
      key: ValueKey('dismiss-${item.cartItemId}'),
      direction: isLoading
          ? DismissDirection.none
          : DismissDirection.endToStart,
      onDismissed: (_) => onRemove(),
      background: _DeleteBackground(itemName: item.name),
      confirmDismiss: (_) => _confirmDelete(context),
      child: Material(
        color: isSelected
            ? colors.primaryContainer.withValues(alpha: 0.35)
            : colors.surface,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.md,
          ),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.outlineVariant)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: Checkbox(
                  key: Key('cart-selection-${item.cartItemId}'),
                  value: isSelected,
                  onChanged: onSelectionChanged == null || isLoading
                      ? null
                      : (value) => onSelectionChanged!(value ?? false),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              ClipRRect(
                borderRadius: AppSpacing.borderRadiusSmall,
                child: ColoredBox(
                  color: colors.surfaceContainerHighest,
                  child: SafeNetworkImage(
                    url: item.imageUrl,
                    fit: BoxFit.cover,
                    width: 80,
                    height: 80,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _ProductDetails(itemTile: this)),
            ],
          ),
        ),
      ),
    );
  }

  Future<bool> _confirmDelete(BuildContext context) async {
    final localizations = AppLocalizations.of(context);
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(localizations.removeCartItem),
        content: Text(localizations.removeCartItemConfirmation(item.name)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(localizations.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(localizations.remove),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}

class _ProductDetails extends StatelessWidget {
  const _ProductDetails({required this.itemTile});

  final CartItemTile itemTile;

  @override
  Widget build(BuildContext context) {
    final item = itemTile.item;
    final colors = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final localizations = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          item.name,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
        ),
        if (item.optionName?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            item.optionName!,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: textTheme.bodySmall?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xxs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              LocalizedFormatters.currency(context, item.price),
              style: textTheme.titleSmall?.copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (itemTile.hasDiscount && itemTile.originalPrice != null)
              Text(
                LocalizedFormatters.currency(context, itemTile.originalPrice!),
                style: textTheme.bodySmall?.copyWith(
                  color: colors.onSurfaceVariant,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            QuantityStepper(
              quantity: item.quantity,
              onChanged: itemTile.onQuantityChanged,
              enabled: !itemTile.isLoading,
            ),
            if (itemTile.isLoading)
              const SizedBox.square(
                dimension: 48,
                child: Padding(
                  padding: EdgeInsets.all(14),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else
              IconButton(
                onPressed: itemTile.onRemove,
                tooltip: localizations.removeCartItem,
                color: colors.error,
                icon: const Icon(Icons.delete_outline),
                constraints: const BoxConstraints.tightFor(
                  width: 48,
                  height: 48,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _DeleteBackground extends StatelessWidget {
  const _DeleteBackground({required this.itemName});

  final String itemName;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ColoredBox(
      color: colors.error,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Align(
          alignment: Alignment.centerRight,
          child: Semantics(
            label: AppLocalizations.of(
              context,
            ).removeCartItemConfirmation(itemName),
            child: Icon(Icons.delete_outline, color: colors.onError),
          ),
        ),
      ),
    );
  }
}

class CartItemTileSkeleton extends StatelessWidget {
  const CartItemTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SkeletonBox(width: 48, height: 48, color: color),
          const SizedBox(width: AppSpacing.xs),
          _SkeletonBox(width: 80, height: 80, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonBox(height: 18, color: color),
                const SizedBox(height: AppSpacing.xs),
                _SkeletonBox(width: 96, height: 14, color: color),
                const SizedBox(height: AppSpacing.md),
                _SkeletonBox(width: 136, height: 48, color: color),
              ],
            ),
          ),
        ],
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
