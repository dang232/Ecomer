import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';

void main() {
  test('clearing a cart also clears its coupon and discount', () {
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
      ],
      appliedCouponCode: 'SAVE10',
      discountAmount: 50000,
      updatedAt: DateTime(2026),
    );

    final cleared = cart.clearItems();

    expect(cleared.items, isEmpty);
    expect(cleared.appliedCouponCode, isNull);
    expect(cleared.discountAmount, 0);
  });
}
