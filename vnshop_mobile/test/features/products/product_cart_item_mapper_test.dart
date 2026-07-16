import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/cart/presentation/mappers/product_cart_item_mapper.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';

void main() {
  test('maps the selected product quantity into one stable cart item', () {
    final product = ProductModel(
      id: 'product-42',
      name: 'Studio headphones',
      description: 'Closed-back monitoring headphones',
      price: 1250000,
      imageUrl: 'https://cdn.example.com/headphones.png',
      stock: 8,
      categoryId: 'audio',
      categoryName: 'Audio',
      createdAt: DateTime(2026),
      updatedAt: DateTime(2026),
    );

    final item = mapProductToCartItem(product: product, quantity: 3);

    expect(item.cartItemId, 'product-42');
    expect(item.productId, 'product-42');
    expect(item.name, 'Studio headphones');
    expect(item.imageUrl, 'https://cdn.example.com/headphones.png');
    expect(item.price, 1250000);
    expect(item.quantity, 3);
  });
}
