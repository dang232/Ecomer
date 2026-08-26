import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_state.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/cart/presentation/pages/cart_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/orders/domain/repositories/order_repository.dart';
import '../../features/orders/presentation/bloc/order_list_bloc.dart';
import '../../features/orders/presentation/bloc/order_detail_cubit.dart';
import '../../features/orders/presentation/pages/order_detail_page.dart';
import '../../features/orders/presentation/pages/order_list_page.dart';
import '../../features/products/data/models/product_model.dart';
import '../../features/products/presentation/pages/product_list_page.dart';
import '../../features/products/presentation/pages/product_detail_route_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/profile/presentation/pages/settings_page.dart';
import '../../features/profile/presentation/pages/account_destination_page.dart';
import '../../features/wishlist/presentation/pages/favorites_page.dart';
import '../../features/checkout/presentation/pages/checkout_page.dart';
import '../../features/checkout/presentation/pages/address_form_page.dart';
import '../../features/checkout/presentation/bloc/checkout_bloc.dart';
import '../../features/checkout/domain/repositories/checkout_repository.dart';
import '../../core/notifications/onesignal_handler.dart';
import '../shell/main_shell.dart';
import '../../l10n/generated/app_localizations.dart';
import 'app_routes.dart';
import 'checkout_route_args.dart';

/// Listenable wrapper for AuthBloc to work with GoRouter's refreshListenable
class AuthBlocListenable extends ChangeNotifier {
  AuthBlocListenable(AuthBloc authBloc) {
    _subscription = authBloc.stream.listen((_) {
      notifyListeners();
    });
  }

  late final StreamSubscription<AuthState> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

GoRouter buildAppRouter(BuildContext context) {
  final authBloc = context.read<AuthBloc>();
  return GoRouter(
    initialLocation: '/',
    refreshListenable: AuthBlocListenable(authBloc),
    redirect: (context, state) {
      final authState = context.read<AuthBloc>().state;
      return AppRoutes.redirectFor(
        location: state.uri,
        isAuthenticated: authState.isAuthenticated,
      );
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
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
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
                          final extra = state.extra;
                          return ProductDetailRoutePage(
                            productId: state.pathParameters['productId'] ?? '',
                            initialProduct: extra is ProductModel
                                ? extra
                                : null,
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
                   child: const ProductListPage(),
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
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
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
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
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) {
                        return FadeTransition(opacity: animation, child: child);
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
        builder: (context, state) {
          final extra = state.extra;
          return BlocProvider(
            create: (context) {
              final checkoutRepository = context.read<CheckoutRepository>();
               final user = context.read<AuthBloc>().state.user;
               return CheckoutBloc(repository: checkoutRepository, userId: user?.id);
            },
            child: CheckoutPage(
              routeArgs: extra is CheckoutRouteArgs ? extra : null,
            ),
          );
        },
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
          create: (context) =>
              OrderListBloc(orderRepository: context.read<OrderRepository>()),
          child: const OrderListPage(),
        ),
      ),
      GoRoute(
        path: '/orders/:orderId',
        name: 'orderDetail',
        builder: (context, state) {
          final orderId = state.pathParameters['orderId'] ?? '';
          return BlocProvider(
            create: (context) => OrderDetailCubit(
              orderId: orderId,
              repository: context.read<OrderRepository>(),
            ),
            child: OrderDetailPage(orderId: orderId),
          );
        },
      ),
      GoRoute(
        path: '/promotions',
        name: 'promotions',
         builder: (context, state) => const ProductListPage(),
      ),
      // Product routes (non-shell for deep links)
      GoRoute(
        path: '/product/:productId',
        name: 'productDetailDeep',
        builder: (context, state) {
          final extra = state.extra;
          return ProductDetailRoutePage(
            productId: state.pathParameters['productId'] ?? '',
            initialProduct: extra is ProductModel ? extra : null,
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
        builder: (context, state) => const FavoritesPage(),
      ),
      // Addresses route
      GoRoute(
        path: '/addresses',
        name: 'addresses',
          builder: (context, state) => AccountDestinationPage(
            title: AppLocalizations.of(context).accountAddressesTitle, icon: Icons.location_on_outlined,
            message: AppLocalizations.of(context).accountAddressesMessage,
          ),
      ),
      // Payment methods route
      GoRoute(
        path: '/payment-methods',
        name: 'paymentMethods',
          builder: (context, state) => AccountDestinationPage(
            title: AppLocalizations.of(context).accountPaymentMethodsTitle, icon: Icons.payment_outlined,
            message: AppLocalizations.of(context).accountPaymentMethodsMessage,
          ),
      ),
      // Notifications route
      GoRoute(
        path: '/notifications',
        name: 'notifications',
          builder: (context, state) => AccountDestinationPage(
            title: AppLocalizations.of(context).accountNotificationsTitle, icon: Icons.notifications_outlined,
            message: AppLocalizations.of(context).accountNotificationsMessage,
          ),
      ),
      // Help route
      GoRoute(
        path: '/help',
        name: 'help',
          builder: (context, state) => AccountDestinationPage(
            title: AppLocalizations.of(context).accountHelpTitle, icon: Icons.help_outline,
            message: AppLocalizations.of(context).accountHelpMessage,
          ),
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
