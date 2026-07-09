import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/models/cart_item_model.dart';
import 'quantity_stepper.dart';

/// Individual cart item tile with swipe-to-delete functionality,
/// selection state, and animated quantity changes.
class CartItemTile extends StatefulWidget {
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

  /// The cart item to display
  final CartItemModel item;

  /// Callback when quantity changes
  final ValueChanged<int> onQuantityChanged;

  /// Callback when item is removed/deleted
  final VoidCallback onRemove;

  /// Whether this item is selected
  final bool isSelected;

  /// Callback when selection state changes
  final ValueChanged<bool>? onSelectionChanged;

  /// Whether an async operation is in progress
  final bool isLoading;

  /// Whether there's a discount applied
  final bool hasDiscount;

  /// Original price before discount
  final double? originalPrice;

  @override
  State<CartItemTile> createState() => _CartItemTileState();
}

class _CartItemTileState extends State<CartItemTile>
    with SingleTickerProviderStateMixin {
  late AnimationController _quantityController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _quantityController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.95), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.95, end: 1.0), weight: 50),
    ]).animate(
      CurvedAnimation(parent: _quantityController, curve: Curves.easeInOut),
    );
  }

  @override
  void didUpdateWidget(CartItemTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.quantity != widget.item.quantity) {
      _quantityController.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(widget.item.cartItemId),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => widget.onRemove(),
      background: _buildDeleteBackground(),
      confirmDismiss: (_) => _confirmDelete(context),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: widget.isSelected
              ? AppColors.primaryContainer.withValues(alpha: 0.3)
              : AppColors.surface,
          border: Border(
            bottom: BorderSide(
              color: AppColors.outlineVariant.withValues(alpha: 0.5),
              width: 1,
            ),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Selection checkbox
              _buildCheckbox(),
              const SizedBox(width: AppSpacing.sm),
              // Product image
              _buildProductImage(),
              const SizedBox(width: AppSpacing.sm),
              // Product details
              Expanded(child: _buildProductDetails()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCheckbox() {
    return GestureDetector(
      onTap: widget.onSelectionChanged != null
          ? () => widget.onSelectionChanged!(!widget.isSelected)
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: widget.isSelected ? AppColors.primary : AppColors.surface,
          borderRadius: AppSpacing.borderRadiusMicro,
          border: Border.all(
            color: widget.isSelected ? AppColors.primary : AppColors.outline,
            width: 2,
          ),
        ),
        child: widget.isSelected
            ? const Icon(
                Icons.check,
                size: 16,
                color: AppColors.onPrimary,
              )
            : null,
      ),
    );
  }

  Widget _buildProductImage() {
    return ClipRRect(
      borderRadius: AppSpacing.borderRadiusSmall,
      child: Container(
        width: 80,
        height: 80,
        color: AppColors.surfaceVariant,
        child: SafeNetworkImage(
          url: widget.item.imageUrl,
          fit: BoxFit.cover,
          width: 80,
          height: 80,
        ),
      ),
    );
  }

  Widget _buildProductDetails() {
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: '₫',
      decimalDigits: 0,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Product name (2 lines max)
        Text(
          widget.item.name,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: AppColors.onSurface,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.xxs),
        // Variant info (size, color)
        if (widget.item.optionName != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: AppSpacing.xxs,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: AppSpacing.borderRadiusMicro,
            ),
            child: Text(
              widget.item.optionName!,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        const SizedBox(height: AppSpacing.xs),
        // Price section
        Row(
          children: [
            Text(
              formatter.format(widget.item.price),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.priceCurrent,
              ),
            ),
            if (widget.hasDiscount && widget.originalPrice != null) ...[
              const SizedBox(width: AppSpacing.xs),
              Text(
                formatter.format(widget.originalPrice),
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.priceOriginal,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        // Quantity stepper and delete button
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            ScaleTransition(
              scale: _scaleAnimation,
              child: QuantityStepper(
                quantity: widget.item.quantity,
                onChanged: widget.onQuantityChanged,
                enabled: !widget.isLoading,
              ),
            ),
            IconButton(
              icon: widget.isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.error,
                      ),
                    )
                  : const Icon(Icons.delete_outline),
              onPressed: widget.isLoading ? null : widget.onRemove,
              color: AppColors.error,
              iconSize: 22,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              tooltip: 'Xóa sản phẩm',
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDeleteBackground() {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: AppSpacing.lg),
      color: AppColors.error,
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.delete_outline,
            color: AppColors.onError,
            size: 24,
          ),
          SizedBox(height: 4),
          Text(
            'Xóa',
            style: TextStyle(
              color: AppColors.onError,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Future<bool> _confirmDelete(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa sản phẩm'),
        content: Text('Bạn có muốn xóa "${widget.item.name}" khỏi giỏ hàng?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error,
            ),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}

/// Skeleton loader for CartItemTile
class CartItemTileSkeleton extends StatelessWidget {
  const CartItemTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Checkbox skeleton
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: AppSpacing.borderRadiusMicro,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Image skeleton
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: AppSpacing.borderRadiusSmall,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Details skeleton
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 15,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: AppSpacing.borderRadiusMicro,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Container(
                  height: 12,
                  width: 80,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: AppSpacing.borderRadiusMicro,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  height: 15,
                  width: 100,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: AppSpacing.borderRadiusMicro,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      height: 36,
                      width: 120,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceVariant,
                        borderRadius: AppSpacing.borderRadiusSmall,
                      ),
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceVariant,
                        borderRadius: AppSpacing.borderRadiusMicro,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
