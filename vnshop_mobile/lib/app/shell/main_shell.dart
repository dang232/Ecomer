import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../l10n/generated/app_localizations.dart';
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

  void _onTap(BuildContext context, int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final destinations = [
      const _NavigationDestination(icon: Icons.home_outlined, selectedIcon: Icons.home, label: '', route: '/'),
      const _NavigationDestination(icon: Icons.grid_view_outlined, selectedIcon: Icons.grid_view, label: '', route: '/categories'),
      const _NavigationDestination(icon: Icons.shopping_cart_outlined, selectedIcon: Icons.shopping_cart, label: '', route: '/cart'),
      const _NavigationDestination(icon: Icons.person_outline, selectedIcon: Icons.person, label: '', route: '/profile'),
    ];
    final labels = [l10n.home, l10n.categories, l10n.cart, l10n.account];
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
            for (var index = 0; index < destinations.length; index++)
              NavigationDestination(
                icon: destinations[index].icon == Icons.shopping_cart_outlined
                    ? BlocBuilder<CartBloc, CartState>(
                        builder: (context, state) => Badge(
                          isLabelVisible: state.itemCount > 0,
                          label: Text(state.itemCount > 99 ? '99+' : state.itemCount.toString()),
                          child: Icon(destinations[index].icon),
                        ),
                      )
                    : Icon(destinations[index].icon),
                selectedIcon: destinations[index].selectedIcon == Icons.shopping_cart
                    ? BlocBuilder<CartBloc, CartState>(
                        builder: (context, state) => Badge(
                          isLabelVisible: state.itemCount > 0,
                          label: Text(state.itemCount > 99 ? '99+' : state.itemCount.toString()),
                          child: Icon(destinations[index].selectedIcon),
                        ),
                      )
                    : Icon(destinations[index].selectedIcon),
                 label: labels[index],
              ),
          ],
        ),
      ),
    );
  }
}
