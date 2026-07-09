import '../../data/models/cart_item_model.dart';
import '../../data/models/cart_model.dart';

abstract class CartRepository {
  Future<CartModel> getCart();
  Future<CartModel> addItem(CartItemModel item);
  Future<CartModel> removeItem(String cartItemId);
  Future<CartModel> updateItemQuantity(String cartItemId, int quantity);
  Future<CartModel> applyCoupon(String couponCode);
  Future<CartModel> removeCoupon();
  Future<void> clearCart();
  Future<void> syncPendingOperations();
  bool get isOnline;
}
