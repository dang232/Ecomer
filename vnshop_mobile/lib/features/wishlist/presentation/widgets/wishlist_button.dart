import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../bloc/wishlist_cubit.dart';

class WishlistButton extends StatelessWidget {
  const WishlistButton({
    required this.productId,
    required this.returnLocation,
    this.activeColor,
    this.inactiveColor,
    this.progressColor,
    this.backgroundColor,
    super.key,
  });

  final String productId;
  final String returnLocation;
  final Color? activeColor;
  final Color? inactiveColor;
  final Color? progressColor;
  final Color? backgroundColor;

  Future<void> _toggle(BuildContext context) async {
    if (!context.read<AuthBloc>().state.isAuthenticated) {
      context.push(
        Uri(
          path: AppRoutes.login,
          queryParameters: {'next': returnLocation},
        ).toString(),
      );
      return;
    }

    final inWishlist = await context.read<WishlistCubit>().toggle(productId);
    if (!context.mounted) return;

    final localizations = AppLocalizations.of(context);
    final message = switch (inWishlist) {
      true => localizations.addedToFavorites,
      false => localizations.removedFromFavorites,
      null => localizations.wishlistUpdateError,
    };
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final state = context.watch<WishlistCubit>().state;
    final isFavorite = state.contains(productId);
    final isPending = state.isPending(productId);
    final theme = Theme.of(context);

    return Semantics(
      toggled: isFavorite,
      child: IconButton(
        constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
        style: IconButton.styleFrom(backgroundColor: backgroundColor),
        tooltip: isFavorite
            ? localizations.removeFromFavorites
            : localizations.addToFavorites,
        onPressed: isPending ? null : () => _toggle(context),
        icon: isPending
            ? SizedBox.square(
                dimension: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: progressColor ?? theme.colorScheme.primary,
                ),
              )
            : Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite
                    ? activeColor ?? theme.colorScheme.error
                    : inactiveColor ?? theme.colorScheme.onSurfaceVariant,
              ),
      ),
    );
  }
}
