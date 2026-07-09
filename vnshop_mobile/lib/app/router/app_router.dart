import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/cart/presentation/pages/cart_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/orders/presentation/pages/order_detail_page.dart';
import '../../features/orders/presentation/pages/order_list_page.dart';
import '../../features/orders/data/datasources/order_local_datasource.dart';
import '../../features/orders/data/datasources/order_remote_datasource.dart';
import '../../features/orders/data/repositories/order_repository_impl.dart';
import '../../features/orders/presentation/bloc/order_list_bloc.dart';
import '../../features/products/data/models/product_model.dart';
import '../../features/products/presentation/pages/product_list_page.dart';
import '../../features/products/presentation/pages/product_detail_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/profile/presentation/pages/settings_page.dart';
import '../../features/checkout/presentation/pages/checkout_page.dart';
import '../../features/checkout/presentation/pages/address_form_page.dart';
import '../../features/checkout/presentation/bloc/checkout_bloc.dart';
import '../../features/checkout/domain/repositories/checkout_repository.dart';
import '../../core/notifications/onesignal_handler.dart';
import '../shell/main_shell.dart';

typedef AuthStatusReader = bool Function();

bool _stubAuthStatus() => false;

final appRouter = buildAppRouter(isAuthenticated: _stubAuthStatus);

GoRouter buildAppRouter({required AuthStatusReader isAuthenticated}) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final authenticated = isAuthenticated();
      final isGoingToLogin = state.matchedLocation == '/login';

      // ponytail: real session state is wired in Phase 2 auth work.
      if (!authenticated && state.matchedLocation == '/checkout') {
        return '/login';
      }

      if (authenticated && isGoingToLogin) {
        return '/';
      }

      return null;
    },
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          // Home branch
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                name: 'home',
                pageBuilder: (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const HomePage(),
                  transitionsBuilder: (context, animation, secondaryAnimation, child) {
                    return FadeTransition(
                      opacity: animation,
                      child: child,
                    );
                  },
                ),
                routes: [
                  GoRoute(
                    path: 'products',
                    name: 'products',
                    builder: (context, state) => const ProductListPage(),
                    routes: [
                      GoRoute(
                        path: ':productId',
                        name: 'productDetail',
                        builder: (context, state) {
                          final product = state.extra as ProductModel?;
                          if (product != null) {
                            return ProductDetailPage(product: product);
                          }
                          // Fallback if no product passed
                          return const Scaffold(
                            body: Center(child: CircularProgressIndicator()),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          // Categories branch
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/categories',
                name: 'categories',
                pageBuilder: (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const PlaceholderPage(title: 'Danh mục'),
                  transitionsBuilder: (context, animation, secondaryAnimation, child) {
                    return FadeTransition(
                      opacity: animation,
                      child: child,
                    );
                  },
                ),
              ),
            ],
          ),
          // Cart branch
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/cart',
                name: 'cart',
                pageBuilder: (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const CartPage(),
                  transitionsBuilder: (context, animation, secondaryAnimation, child) {
                    return FadeTransition(
                      opacity: animation,
                      child: child,
                    );
                  },
                ),
              ),
            ],
          ),
          // Profile branch
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                name: 'profile',
                pageBuilder: (context, state) => CustomTransitionPage(
                  key: state.pageKey,
                  child: const ProfilePage(),
                  transitionsBuilder: (context, animation, secondaryAnimation, child) {
                    return FadeTransition(
                      opacity: animation,
                      child: child,
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
      // Non-shell routes (outside of bottom navigation)
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: '/checkout',
        name: 'checkout',
        builder: (context, state) => BlocProvider(
          create: (context) {
            final checkoutRepository = context.read<CheckoutRepository>();
            return CheckoutBloc(repository: checkoutRepository);
          },
          child: const CheckoutPage(),
        ),
        routes: [
          GoRoute(
            path: 'address/new',
            name: 'newAddress',
            builder: (context, state) => BlocProvider.value(
              value: context.read<CheckoutBloc>(),
              child: const AddressFormPage(),
            ),
          ),
          GoRoute(
            path: 'address/:addressId',
            name: 'editAddress',
            builder: (context, state) {
              final addressId = state.pathParameters['addressId'];
              return BlocProvider.value(
                value: context.read<CheckoutBloc>(),
                child: AddressFormPage(addressId: addressId),
              );
            },
          ),
        ],
      ),
      // Order routes
      GoRoute(
        path: '/orders',
        name: 'orders',
        builder: (context, state) => BlocProvider(
          create: (context) {
            // Create repository with injected dependencies
            final dio = Dio(); // TODO: Inject Dio from dependency injection
            final orderRepository = OrderRepositoryImpl(
              remoteDataSource: OrderRemoteDataSourceImpl(dio: dio),
              localDataSource: OrderLocalDataSourceImpl(),
            );
            return OrderListBloc(orderRepository: orderRepository);
          },
          child: const OrderListPage(),
        ),
      ),
      GoRoute(
        path: '/orders/:orderId',
        name: 'orderDetail',
        builder: (context, state) {
          final orderId = state.pathParameters['orderId'] ?? '';
          return OrderDetailPage(orderId: orderId);
        },
      ),
      GoRoute(
        path: '/promotions',
        name: 'promotions',
        builder: (context, state) => const PlaceholderPage(title: 'Khuyến mãi'),
      ),
      // Product routes (non-shell for deep links)
      GoRoute(
        path: '/product/:productId',
        name: 'productDetailDeep',
        builder: (context, state) {
          final product = state.extra as ProductModel?;
          if (product != null) {
            return ProductDetailPage(product: product);
          }
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        },
      ),
      // Settings route
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsPage(),
      ),
      // Favorites route
      GoRoute(
        path: '/favorites',
        name: 'favorites',
        builder: (context, state) => const PlaceholderPage(title: 'Yêu thích'),
      ),
      // Addresses route
      GoRoute(
        path: '/addresses',
        name: 'addresses',
        builder: (context, state) => const PlaceholderPage(title: 'Địa chỉ'),
      ),
      // Payment methods route
      GoRoute(
        path: '/payment-methods',
        name: 'paymentMethods',
        builder: (context, state) => const PlaceholderPage(title: 'Thanh toán'),
      ),
      // Notifications route
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (context, state) => const PlaceholderPage(title: 'Thông báo'),
      ),
      // Help route
      GoRoute(
        path: '/help',
        name: 'help',
        builder: (context, state) => const PlaceholderPage(title: 'Trợ giúp'),
      ),
    ],
  );
}

/// Setup OneSignal deep linking
/// Call this after app initialization to handle notification taps
void setupOneSignalDeepLinking(GoRouter router) {
  OneSignalHandler.instance.onNotificationTap = (notification) {
    final deepLink = notification.deepLink;

    if (deepLink != null) {
      // Navigate to the appropriate screen
      router.go(deepLink);
    }
  };
}

class PlaceholderPage extends StatelessWidget {
  const PlaceholderPage({required this.title, super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            if (title == 'Đơn hàng của tôi') ...[
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.push('/orders'),
                child: const Text('Xem danh sách đơn hàng'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
