import '../../../cart/data/models/cart_item_model.dart';
import '../../../cart/data/models/cart_model.dart';
import '../../../../app/router/checkout_route_args.dart';

class CheckoutCartInput {
  CheckoutCartInput._({
    required this.items,
    required this.selectedCartItemIds,
    required this.subtotal,
    required this.discountAmount,
    required this.couponCode,
    required this.includesEntireCart,
  });

  factory CheckoutCartInput.fromCart(
    CartModel? cart, {
    CheckoutRouteArgs? args,
  }) {
    final cartItems = cart?.items ?? const <CartItemModel>[];
    final requestedIds = args?.selectedCartItemIds;
    final selectedItems = List<CartItemModel>.unmodifiable(
      requestedIds == null
          ? cartItems
          : cartItems.where((item) => requestedIds.contains(item.cartItemId)),
    );
    final includesEntireCart = selectedItems.length == cartItems.length;

    return CheckoutCartInput._(
      items: selectedItems,
      selectedCartItemIds: Set.unmodifiable(
        selectedItems.map((item) => item.cartItemId),
      ),
      subtotal: selectedItems.fold(0, (total, item) => total + item.totalPrice),
      discountAmount: includesEntireCart ? cart?.discountAmount ?? 0 : 0,
      couponCode: cart?.appliedCouponCode,
      includesEntireCart: includesEntireCart,
    );
  }

  final List<CartItemModel> items;
  final Set<String> selectedCartItemIds;
  final double subtotal;
  final double discountAmount;
  final String? couponCode;
  final bool includesEntireCart;

  bool get isEmpty => items.isEmpty;
}
