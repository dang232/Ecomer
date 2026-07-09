import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../features/cart/presentation/bloc/cart_bloc.dart';
import '../../features/cart/presentation/bloc/cart_state.dart';

/// Navigation destinations for the bottom navigation shell
class _NavigationDestination {
  const _NavigationDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final String route;
}

/// Bottom navigation shell with 4 tabs: Home, Categories, Cart, Profile
class MainShell extends StatelessWidget {
  const MainShell({
    required this.navigationShell,
    super.key,
  });

  final StatefulNavigationShell navigationShell;

  static const _destinations = [
    _NavigationDestination(
      icon: Icons.home_outlined,
      selectedIcon: Icons.home,
      label: 'Trang chủ',
      route: '/',
    ),
    _NavigationDestination(
      icon: Icons.grid_view_outlined,
      selectedIcon: Icons.grid_view,
      label: 'Danh mục',
      route: '/categories',
    ),
    _NavigationDestination(
      icon: Icons.shopping_cart_outlined,
      selectedIcon: Icons.shopping_cart,
      label: 'Giỏ hàng',
      route: '/cart',
    ),
    _NavigationDestination(
      icon: Icons.person_outline,
      selectedIcon: Icons.person,
      label: 'Tài khoản',
      route: '/profile',
    ),
  ];

  void _onTap(BuildContext context, int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 8,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (index) => _onTap(context, index),
          animationDuration: const Duration(milliseconds: 300),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            for (final destination in _destinations)
              NavigationDestination(
                icon: destination.icon == Icons.shopping_cart_outlined
                    ? BlocBuilder<CartBloc, CartState>(
                        builder: (context, state) {
                          return Badge(
                            isLabelVisible: state.itemCount > 0,
                            label: Text(
                              state.itemCount > 99
                                  ? '99+'
                                  : state.itemCount.toString(),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            child: Icon(destination.icon),
                          );
                        },
                      )
                    : Icon(destination.icon),
                selectedIcon: destination.selectedIcon == Icons.shopping_cart
                    ? BlocBuilder<CartBloc, CartState>(
                        builder: (context, state) {
                          return Badge(
                            isLabelVisible: state.itemCount > 0,
                            label: Text(
                              state.itemCount > 99
                                  ? '99+'
                                  : state.itemCount.toString(),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            child: Icon(destination.selectedIcon),
                          );
                        },
                      )
                    : Icon(destination.selectedIcon),
                label: destination.label,
              ),
          ],
        ),
      ),
    );
  }
}
