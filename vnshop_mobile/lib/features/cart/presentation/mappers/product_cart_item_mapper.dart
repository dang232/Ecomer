import '../../../products/data/models/product_model.dart';
import '../../data/models/cart_item_model.dart';

CartItemModel mapProductToCartItem({
  required ProductModel product,
  required int quantity,
}) {
  if (quantity < 1) {
    throw ArgumentError.value(quantity, 'quantity', 'must be at least 1');
  }

  return CartItemModel(
    cartItemId: product.id,
    productId: product.id,
    name: product.name,
    imageUrl: product.imageUrl.isEmpty ? null : product.imageUrl,
    price: product.price,
    quantity: quantity,
  );
}
