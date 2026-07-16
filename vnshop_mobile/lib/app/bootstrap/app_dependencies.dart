import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../../core/network/dio_client.dart';
import '../../features/auth/data/datasources/auth_local_datasource.dart';
import '../../features/auth/data/datasources/auth_remote_datasource.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/cart/data/datasources/cart_local_datasource.dart';
import '../../features/cart/data/datasources/cart_remote_datasource.dart';
import '../../features/cart/data/repositories/cart_repository_impl.dart';
import '../../features/cart/domain/repositories/cart_repository.dart';
import '../../features/checkout/data/repositories/checkout_repository_impl.dart';
import '../../features/checkout/domain/repositories/checkout_repository.dart';
import '../../features/orders/data/datasources/order_local_datasource.dart';
import '../../features/orders/data/datasources/order_remote_datasource.dart';
import '../../features/orders/data/repositories/order_repository_impl.dart';
import '../../features/orders/domain/repositories/order_repository.dart';
import '../../features/products/data/datasources/product_local_datasource.dart';
import '../../features/products/data/datasources/product_remote_datasource.dart';
import '../../features/products/data/repositories/product_repository_impl.dart';
import '../../features/products/domain/repositories/product_repository.dart';
import '../../features/reviews/data/datasources/review_remote_datasource.dart';
import '../../features/reviews/data/repositories/review_repository_impl.dart';
import '../../features/reviews/domain/repositories/review_repository.dart';
import '../../features/wishlist/data/datasources/wishlist_remote_data_source.dart';
import '../../features/wishlist/data/repositories/wishlist_repository_impl.dart';
import '../../features/wishlist/domain/repositories/wishlist_repository.dart';

class AppDependencies {
  const AppDependencies({
    required this.authRepository,
    required this.cartRepository,
    required this.checkoutRepository,
    required this.orderRepository,
    required this.productRepository,
    required this.reviewRepository,
    required this.wishlistRepository,
  });

  factory AppDependencies.production({
    required AuthLocalDataSource authLocalDataSource,
  }) {
    final dio = DioClient.instance.dio;
    return AppDependencies(
      authRepository: AuthRepositoryImpl(
        localDataSource: authLocalDataSource,
        remoteDataSource: AuthRemoteDataSourceImpl(),
      ),
      cartRepository: CartRepositoryImpl(
        localDataSource: CartLocalDataSourceImpl(),
        remoteDataSource: CartRemoteDataSourceImpl(dio: dio),
      ),
      checkoutRepository: CheckoutRepositoryImpl(dio: dio),
      orderRepository: OrderRepositoryImpl(
        remoteDataSource: OrderRemoteDataSourceImpl(dio: dio),
        localDataSource: OrderLocalDataSourceImpl(),
      ),
      productRepository: ProductRepositoryImpl(
        remoteDataSource: ProductRemoteDataSourceImpl(dio: dio),
        localDataSource: ProductLocalDataSourceImpl(),
      ),
      reviewRepository: ReviewRepositoryImpl(
        remoteDataSource: ReviewRemoteDataSourceImpl(dio: dio),
      ),
      wishlistRepository: WishlistRepositoryImpl(
        remoteDataSource: WishlistRemoteDataSourceImpl(dio: dio),
      ),
    );
  }

  final AuthRepository authRepository;
  final CartRepository cartRepository;
  final CheckoutRepository checkoutRepository;
  final OrderRepository orderRepository;
  final ProductRepository productRepository;
  final ReviewRepository reviewRepository;
  final WishlistRepository wishlistRepository;
}

class AppDependenciesScope extends StatelessWidget {
  const AppDependenciesScope({
    required this.dependencies,
    required this.child,
    super.key,
  });

  final AppDependencies dependencies;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<AuthRepository>.value(value: dependencies.authRepository),
        Provider<CartRepository>.value(value: dependencies.cartRepository),
        Provider<CheckoutRepository>.value(
          value: dependencies.checkoutRepository,
        ),
        Provider<OrderRepository>.value(value: dependencies.orderRepository),
        Provider<ProductRepository>.value(
          value: dependencies.productRepository,
        ),
        Provider<ReviewRepository>.value(value: dependencies.reviewRepository),
        Provider<WishlistRepository>.value(
          value: dependencies.wishlistRepository,
        ),
      ],
      child: child,
    );
  }
}
