import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/models/cart_item_model.dart';
import '../bloc/cart_bloc.dart';
import '../bloc/cart_event.dart';
import '../bloc/cart_state.dart';
import '../widgets/cart_item_tile.dart';
import '../widgets/cart_summary.dart';
import '../widgets/coupon_section.dart';

/// Complete cart page with AppBar, item list, coupon input,
/// order summary, and checkout button.
class CartPage extends StatefulWidget {
  const CartPage({super.key});

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  // Track selected items for checkout
  final Set<String> _selectedItemIds = {};
  bool _selectAll = false;

  @override
  void initState() {
    super.initState();
    // Initialize cart
    context.read<CartBloc>().add(const CartStarted());
  }

  void _toggleSelectAll(List<CartItemModel> items) {
    setState(() {
      _selectAll = !_selectAll;
      if (_selectAll) {
        _selectedItemIds.addAll(items.map((i) => i.cartItemId));
      } else {
        _selectedItemIds.clear();
      }
    });
  }

  void _updateSelectAll() {
    final cart = context.read<CartBloc>().state.cart;
    if (cart != null) {
      _selectAll = _selectedItemIds.length == cart.items.length;
    }
  }

  void _clearAllSelections() {
    setState(() {
      _selectAll = false;
      _selectedItemIds.clear();
    });
  }

  void _handleCheckout() {
    if (_selectedItemIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng chọn ít nhất một sản phẩm'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    // Navigate to checkout with selected items
    context.push('/checkout', extra: _selectedItemIds.toList());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceVariant.withValues(alpha: 0.5),
      appBar: _buildAppBar(),
      body: BlocConsumer<CartBloc, CartState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage!),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state.status == CartStatus.loading) {
            return _buildLoadingState();
          }

          if (state.status == CartStatus.error) {
            return _buildErrorState(state.errorMessage);
          }

          if (state.cart == null || state.cart!.isEmpty) {
            return _buildEmptyCartState();
          }

          return _buildCartContent(state);
        },
      ),
      bottomNavigationBar: BlocBuilder<CartBloc, CartState>(
        builder: (context, state) {
          if (state.cart == null || state.cart!.isEmpty) {
            return const SizedBox.shrink();
          }
          return _buildBottomBar(state);
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      title: BlocBuilder<CartBloc, CartState>(
        builder: (context, state) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Giỏ hàng'),
              if (state.itemCount > 0) ...[
                const SizedBox(width: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    state.itemCount.toString(),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onPrimary,
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
      centerTitle: true,
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      actions: [
        BlocBuilder<CartBloc, CartState>(
          builder: (context, state) {
            if (state.cart == null || state.cart!.isEmpty) {
              return const SizedBox.shrink();
            }
            return IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () => _showClearCartDialog(),
              tooltip: 'Xóa tất cả',
            );
          },
        ),
      ],
    );
  }

  Widget _buildLoadingState() {
    return ListView.builder(
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: 3,
      itemBuilder: (context, index) => const CartItemTileSkeleton(),
    );
  }

  Widget _buildErrorState(String? message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error.withValues(alpha: 0.5),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              message ?? 'Đã xảy ra lỗi',
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            VnButton(
              label: 'Thử lại',
              onPressed: () {
                context.read<CartBloc>().add(const CartStarted());
              },
              type: VnButtonType.secondary,
              isFullWidth: false,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyCartState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Empty cart illustration
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                color: AppColors.primaryContainer.withValues(alpha: 0.3),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.shopping_cart_outlined,
                size: 80,
                color: AppColors.primary.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text(
              'Giỏ hàng trống',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              'Hãy thêm sản phẩm vào giỏ hàng của bạn',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            VnPrimaryButton(
              label: 'Mua sắm ngay',
              onPressed: () => context.go('/'),
              isFullWidth: false,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartContent(CartState state) {
    final cart = state.cart!;

    return Column(
      children: [
        // Select all header
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          color: AppColors.surface,
          child: Row(
            children: [
              _buildSelectAllCheckbox(),
              const SizedBox(width: AppSpacing.sm),
              const Text(
                'Chọn tất cả',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.onSurface,
                ),
              ),
              const Spacer(),
              Text(
                '${_selectedItemIds.length}/${cart.items.length} sản phẩm',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        // Cart items list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.only(
              top: AppSpacing.sm,
              bottom: 200, // Space for bottom bar
            ),
            itemCount: cart.items.length,
            itemBuilder: (context, index) {
              final item = cart.items[index];
              return CartItemTile(
                key: ValueKey(item.cartItemId),
                item: item,
                isSelected: _selectedItemIds.contains(item.cartItemId),
                onSelectionChanged: (selected) {
                  if (selected) {
                    _selectedItemIds.add(item.cartItemId);
                  } else {
                    _selectedItemIds.remove(item.cartItemId);
                  }
                  _updateSelectAll();
                  setState(() {});
                },
                onQuantityChanged: (quantity) {
                  context.read<CartBloc>().add(
                        CartItemQuantityUpdated(
                          cartItemId: item.cartItemId,
                          quantity: quantity,
                        ),
                      );
                },
                onRemove: () {
                  context.read<CartBloc>().add(
                        CartItemRemoved(item.cartItemId),
                      );
                  _selectedItemIds.remove(item.cartItemId);
                  _updateSelectAll();
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSelectAllCheckbox() {
    return GestureDetector(
      onTap: () {
        final cart = context.read<CartBloc>().state.cart;
        if (cart != null) {
          _toggleSelectAll(cart.items);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: _selectAll ? AppColors.primary : AppColors.surface,
          borderRadius: AppSpacing.borderRadiusMicro,
          border: Border.all(
            color: _selectAll ? AppColors.primary : AppColors.outline,
            width: 2,
          ),
        ),
        child: _selectAll
            ? const Icon(
                Icons.check,
                size: 16,
                color: AppColors.onPrimary,
              )
            : null,
      ),
    );
  }

  Widget _buildBottomBar(CartState state) {
    final cart = state.cart!;
    final selectedSubtotal = cart.items
        .where((i) => _selectedItemIds.contains(i.cartItemId))
        .fold(0.0, (sum, item) => sum + item.totalPrice);
    final discount = state.discountAmount;

    return Container(
      padding: EdgeInsets.only(
        left: AppSpacing.md,
        right: AppSpacing.md,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).padding.bottom + AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Coupon section
          CouponSection(
            appliedCouponCode: state.appliedCouponCode,
            appliedCouponDiscount: discount,
            isLoading: state.isSyncing,
            errorMessage: state.errorMessage,
            onApply: (code) {
              context.read<CartBloc>().add(CartCouponApplied(code));
            },
            onRemove: () {
              context.read<CartBloc>().add(const CartCouponRemoved());
            },
          ),
          const SizedBox(height: AppSpacing.md),
          // Order summary
          CartSummary(
            subtotal: _selectedItemIds.isNotEmpty ? selectedSubtotal : cart.subtotal,
            discountAmount: discount,
            isFreeShipping: selectedSubtotal >= 200000, // Free shipping over 200k
          ),
          const SizedBox(height: AppSpacing.md),
          // Checkout button
          VnPrimaryButton(
            label: 'Tiến hành đặt hàng',
            onPressed: _selectedItemIds.isNotEmpty ? _handleCheckout : null,
            icon: const Icon(Icons.shopping_bag_outlined, size: 20),
          ),
        ],
      ),
    );
  }

  void _showClearCartDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xóa giỏ hàng'),
        content: const Text('Bạn có chắc muốn xóa tất cả sản phẩm trong giỏ hàng?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.read<CartBloc>().add(const CartCleared());
              _clearAllSelections();
            },
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error,
            ),
            child: const Text('Xóa tất cả'),
          ),
        ],
      ),
    );
  }
}
