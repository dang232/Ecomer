import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/checkout_route_args.dart';
import '../../../../core/design_system/components/async_state_view.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/cart_item_model.dart';
import '../bloc/cart_bloc.dart';
import '../bloc/cart_event.dart';
import '../bloc/cart_selection_cubit.dart';
import '../bloc/cart_state.dart';
import '../widgets/cart_item_tile.dart';
import '../widgets/cart_summary.dart';
import '../widgets/coupon_section.dart';

class CartPage extends StatefulWidget {
  const CartPage({super.key});

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  late final CartSelectionCubit _selectionCubit;

  @override
  void initState() {
    super.initState();
    _selectionCubit = CartSelectionCubit();
    final cartState = context.read<CartBloc>().state;
    if (cartState.cart != null) {
      _reconcileSelection(cartState);
    }
    if (cartState.status == CartStatus.initial ||
        cartState.status == CartStatus.error) {
      context.read<CartBloc>().add(const CartStarted());
    }
  }

  @override
  void dispose() {
    _selectionCubit.close();
    super.dispose();
  }

  void _reconcileSelection(CartState state) {
    final itemIds = state.cart?.items.map((item) => item.cartItemId);
    if (itemIds != null) {
      _selectionCubit.reconcile(itemIds);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CartSelectionCubit>.value(
      value: _selectionCubit,
      child: BlocListener<CartBloc, CartState>(
        listenWhen: (previous, current) =>
            previous.cart != current.cart ||
            previous.failure != current.failure,
        listener: (context, state) {
          _reconcileSelection(state);
          final failure = state.failure;
          if (failure != null) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(_failureMessage(context, failure)),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            context.read<CartBloc>().add(const CartFailureDismissed());
          }
        },
        child: BlocBuilder<CartBloc, CartState>(
          builder: (context, state) => Scaffold(
            appBar: _CartAppBar(
              onClear: state.isNotEmpty ? _showClearCartDialog : null,
            ),
            body: _buildBody(state),
            bottomNavigationBar: state.isNotEmpty
                ? _CartCheckoutBar(cartState: state)
                : null,
          ),
        ),
      ),
    );
  }

  Widget _buildBody(CartState state) {
    final status = resolveAsyncViewStatus(
      isLoading:
          state.status == CartStatus.initial ||
          state.status == CartStatus.loading,
      hasError: state.status == CartStatus.error,
      isEmpty: state.status == CartStatus.loaded && state.isEmpty,
      hasData: state.isNotEmpty,
    );

    return switch (status) {
      AsyncViewStatus.loading => const _CartLoadingState(),
      AsyncViewStatus.error => Center(
        child: AsyncStateView(
          status: AsyncViewStatus.error,
          loading: const SizedBox.shrink(),
          error: const _CartErrorState(),
          empty: const SizedBox.shrink(),
          retryLabel: AppLocalizations.of(context).retry,
          onRetry: () => context.read<CartBloc>().add(const CartStarted()),
          child: const SizedBox.shrink(),
        ),
      ),
      AsyncViewStatus.empty => const _EmptyCartState(),
      AsyncViewStatus.ready => _CartContent(cartState: state),
    };
  }

  String _failureMessage(BuildContext context, CartFailure failure) {
    final localizations = AppLocalizations.of(context);
    return switch (failure) {
      CartFailure.load => localizations.cartLoadError,
      CartFailure.addItem => localizations.cartAddError,
      CartFailure.removeItem => localizations.cartRemoveError,
      CartFailure.updateQuantity => localizations.cartQuantityError,
      CartFailure.invalidCoupon => localizations.cartInvalidCoupon,
      CartFailure.removeCoupon => localizations.cartRemoveCouponError,
      CartFailure.clearCart => localizations.cartClearError,
      CartFailure.sync => localizations.cartSyncError,
      CartFailure.checkoutCleanup => localizations.cartCheckoutCleanupError,
    };
  }

  Future<void> _showClearCartDialog() async {
    final localizations = AppLocalizations.of(context);
    final shouldClear = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(localizations.clearCart),
        content: Text(localizations.clearCartConfirmation),
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
            child: Text(localizations.clearAll),
          ),
        ],
      ),
    );
    if (shouldClear == true && mounted) {
      _selectionCubit.clear();
      context.read<CartBloc>().add(const CartCleared());
    }
  }
}

class _CartAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _CartAppBar({required this.onClear});

  final VoidCallback? onClear;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return AppBar(
      title: Text(localizations.cart),
      actions: [
        if (onClear != null)
          IconButton(
            onPressed: onClear,
            tooltip: localizations.clearCart,
            icon: const Icon(Icons.delete_sweep_outlined),
          ),
      ],
    );
  }
}

class _CartContent extends StatelessWidget {
  const _CartContent({required this.cartState});

  final CartState cartState;

  @override
  Widget build(BuildContext context) {
    final cart = cartState.cart!;
    return BlocBuilder<CartSelectionCubit, CartSelectionState>(
      builder: (context, selection) {
        final selectedIds = selection.selectedItemIds;
        final selectedSubtotal = cart.items
            .where((item) => selectedIds.contains(item.cartItemId))
            .fold<double>(0, (total, item) => total + item.totalPrice);
        final allSelected = selection.isAllSelected(
          cart.items.map((item) => item.cartItemId),
        );

        return RefreshIndicator(
          onRefresh: () async {
            final bloc = context.read<CartBloc>();
            bloc.add(const CartStarted());
            await bloc.stream.firstWhere(
              (state) => state.status != CartStatus.loading,
            );
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _SelectionHeader(
                  cartItems: cart.items,
                  selection: selection,
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.sm)),
              SliverList.builder(
                itemCount: cart.items.length,
                itemBuilder: (context, index) {
                  final item = cart.items[index];
                  return CartItemTile(
                    item: item,
                    isSelected: selection.isSelected(item.cartItemId),
                    isLoading: cartState.isSyncing,
                    onSelectionChanged: (_) => context
                        .read<CartSelectionCubit>()
                        .toggle(item.cartItemId),
                    onQuantityChanged: (quantity) {
                      context.read<CartBloc>().add(
                        CartItemQuantityUpdated(
                          cartItemId: item.cartItemId,
                          quantity: quantity,
                        ),
                      );
                    },
                    onRemove: () => context.read<CartBloc>().add(
                      CartItemRemoved(item.cartItemId),
                    ),
                  );
                },
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  0,
                ),
                sliver: SliverToBoxAdapter(
                  child: CouponSection(
                    appliedCouponCode: cartState.appliedCouponCode,
                    appliedCouponDiscount: cartState.discountAmount,
                    isLoading: cartState.isSyncing,
                    errorMessage: cartState.failure == CartFailure.invalidCoupon
                        ? AppLocalizations.of(context).cartInvalidCoupon
                        : null,
                    onApply: (code) =>
                        context.read<CartBloc>().add(CartCouponApplied(code)),
                    onRemove: () =>
                        context.read<CartBloc>().add(const CartCouponRemoved()),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.all(AppSpacing.md),
                sliver: SliverToBoxAdapter(
                  child: CartSummary(
                    subtotal: selectedSubtotal,
                    discountAmount: allSelected ? cartState.discountAmount : 0,
                    showPromotionRecalculationNote:
                        !allSelected && cartState.appliedCouponCode != null,
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),
            ],
          ),
        );
      },
    );
  }
}

class _SelectionHeader extends StatelessWidget {
  const _SelectionHeader({required this.cartItems, required this.selection});

  final List<CartItemModel> cartItems;
  final CartSelectionState selection;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final itemIds = cartItems.map((item) => item.cartItemId);
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: CheckboxListTile(
        key: const Key('select-all-cart-items'),
        value: selection.isAllSelected(itemIds),
        onChanged: (_) => context.read<CartSelectionCubit>().toggleAll(itemIds),
        controlAffinity: ListTileControlAffinity.leading,
        title: Text(localizations.selectAll),
        subtitle: Text(
          localizations.cartSelectionCount(
            selection.selectedItemIds.length,
            cartItems.length,
          ),
        ),
        secondary: Text(localizations.cartItemCount(cartItems.length)),
      ),
    );
  }
}

class _CartCheckoutBar extends StatelessWidget {
  const _CartCheckoutBar({required this.cartState});

  final CartState cartState;

  @override
  Widget build(BuildContext context) {
    final cart = cartState.cart!;
    return BlocBuilder<CartSelectionCubit, CartSelectionState>(
      builder: (context, selection) {
        final selectedIds = selection.selectedItemIds;
        final subtotal = cart.items
            .where((item) => selectedIds.contains(item.cartItemId))
            .fold<double>(0, (total, item) => total + item.totalPrice);
        final localizations = AppLocalizations.of(context);
        final total = Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localizations.selectedSubtotal,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            Text(
              LocalizedFormatters.currency(context, subtotal),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        );
        final checkoutButton = FilledButton.icon(
          key: const Key('cart-checkout-button'),
          onPressed: selectedIds.isEmpty || cartState.isSyncing
              ? null
              : () => context.push(
                  '/checkout',
                  extra: CheckoutRouteArgs.fromIds(selectedIds),
                ),
          icon: const Icon(Icons.shopping_bag_outlined),
          label: Text(localizations.checkoutItemCount(selectedIds.length)),
        );

        return Material(
          elevation: 8,
          color: Theme.of(context).colorScheme.surface,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final stack =
                      MediaQuery.textScalerOf(context).scale(1) >= 1.4 ||
                      constraints.maxWidth < 420;
                  if (stack) {
                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        total,
                        const SizedBox(height: AppSpacing.sm),
                        SizedBox(height: 48, child: checkoutButton),
                      ],
                    );
                  }
                  return Row(
                    children: [
                      Expanded(child: total),
                      const SizedBox(width: AppSpacing.md),
                      SizedBox(height: 48, child: checkoutButton),
                    ],
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CartLoadingState extends StatelessWidget {
  const _CartLoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: 3,
      itemBuilder: (context, index) => const CartItemTileSkeleton(),
    );
  }
}

class _CartErrorState extends StatelessWidget {
  const _CartErrorState();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, size: 56, color: colors.error),
          const SizedBox(height: AppSpacing.md),
          Text(
            localizations.cartLoadError,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            localizations.cartLoadErrorHelp,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _EmptyCartState extends StatelessWidget {
  const _EmptyCartState();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.shopping_cart_outlined,
              size: 64,
              color: colors.onSurfaceVariant,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              localizations.emptyCart,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              localizations.emptyCartHelp,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: () => context.go('/'),
              icon: const Icon(Icons.storefront_outlined),
              label: Text(localizations.shopNow),
            ),
          ],
        ),
      ),
    );
  }
}
