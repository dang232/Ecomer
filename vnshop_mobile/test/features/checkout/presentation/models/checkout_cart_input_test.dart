import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/app/router/checkout_route_args.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/checkout/presentation/models/checkout_cart_input.dart';

void main() {
  final cart = CartModel(
    id: 'cart-1',
    userId: 'buyer-1',
    items: const [
      CartItemModel(
        cartItemId: 'item-1',
        productId: 'product-1',
        name: 'Headphones',
        price: 500000,
        quantity: 1,
      ),
      CartItemModel(
        cartItemId: 'item-2',
        productId: 'product-2',
        name: 'Keyboard',
        price: 300000,
        quantity: 2,
      ),
    ],
    appliedCouponCode: 'SAVE10',
    discountAmount: 80000,
    updatedAt: DateTime(2026),
  );

  test('uses only selected cart rows for checkout', () {
    final input = CheckoutCartInput.fromCart(
      cart,
      args: const CheckoutRouteArgs({'item-2'}),
    );

    expect(input.items.map((item) => item.cartItemId), ['item-2']);
    expect(input.subtotal, 600000);
    expect(input.selectedCartItemIds, {'item-2'});
  });

  test('does not reuse a whole-cart discount for a partial selection', () {
    final input = CheckoutCartInput.fromCart(
      cart,
      args: const CheckoutRouteArgs({'item-2'}),
    );

    expect(input.discountAmount, 0);
    expect(input.couponCode, 'SAVE10');
    expect(input.includesEntireCart, isFalse);
  });

  test('direct checkout safely includes the current cart', () {
    final input = CheckoutCartInput.fromCart(cart);

    expect(input.items, cart.items);
    expect(input.discountAmount, 80000);
    expect(input.includesEntireCart, isTrue);
  });
}
