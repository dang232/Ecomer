import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:vnshop_mobile/app/bootstrap/app_dependencies.dart';
import 'package:vnshop_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:vnshop_mobile/features/cart/domain/repositories/cart_repository.dart';
import 'package:vnshop_mobile/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:vnshop_mobile/features/orders/domain/repositories/order_repository.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/reviews/domain/repositories/review_repository.dart';
import 'package:vnshop_mobile/features/wishlist/domain/repositories/wishlist_repository.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

class MockCartRepository extends Mock implements CartRepository {}

class MockCheckoutRepository extends Mock implements CheckoutRepository {}

class MockOrderRepository extends Mock implements OrderRepository {}

class MockProductRepository extends Mock implements ProductRepository {}

class MockReviewRepository extends Mock implements ReviewRepository {}

class MockWishlistRepository extends Mock implements WishlistRepository {}

void main() {
  testWidgets('provides one shared instance of every repository', (
    tester,
  ) async {
    final auth = MockAuthRepository();
    final cart = MockCartRepository();
    final checkout = MockCheckoutRepository();
    final orders = MockOrderRepository();
    final products = MockProductRepository();
    final reviews = MockReviewRepository();
    final wishlist = MockWishlistRepository();
    final dependencies = AppDependencies(
      authRepository: auth,
      cartRepository: cart,
      checkoutRepository: checkout,
      orderRepository: orders,
      productRepository: products,
      reviewRepository: reviews,
      wishlistRepository: wishlist,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: AppDependenciesScope(
          dependencies: dependencies,
          child: Builder(
            builder: (context) => Text(
              [
                identical(context.read<AuthRepository>(), auth),
                identical(context.read<CartRepository>(), cart),
                identical(context.read<CheckoutRepository>(), checkout),
                identical(context.read<OrderRepository>(), orders),
                identical(context.read<ProductRepository>(), products),
                identical(context.read<ReviewRepository>(), reviews),
                identical(context.read<WishlistRepository>(), wishlist),
              ].every((value) => value).toString(),
            ),
          ),
        ),
      ),
    );

    expect(find.text('true'), findsOneWidget);
  });
}
