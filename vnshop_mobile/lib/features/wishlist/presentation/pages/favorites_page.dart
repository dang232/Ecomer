import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../products/domain/repositories/product_repository.dart';
import '../../../products/presentation/widgets/product_grid_item.dart';
import '../../../products/presentation/widgets/product_grid_layout.dart';
import '../../../products/presentation/widgets/product_card_skeleton.dart';
import '../bloc/favorites_cubit.dart';
import '../bloc/favorites_state.dart';
import '../bloc/wishlist_cubit.dart';
import '../bloc/wishlist_state.dart';

class FavoritesPage extends StatelessWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final wishlist = context.read<WishlistCubit>();
    return BlocProvider(
      create: (context) {
        final controller = FavoritesCubit(
          productRepository: context.read<ProductRepository>(),
          wishlistCubit: wishlist,
        );
        if (wishlist.state.status == WishlistStatus.initial) {
          unawaited(controller.refresh());
        }
        return controller;
      },
      child: const _FavoritesView(),
    );
  }
}

class _FavoritesView extends StatelessWidget {
  const _FavoritesView();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.favorites),
        actions: [
          IconButton(
            tooltip: localizations.refresh,
            onPressed: context.read<FavoritesCubit>().refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: BlocBuilder<FavoritesCubit, FavoritesState>(
        builder: (context, state) {
          if ((state.status == FavoritesStatus.initial ||
                  state.status == FavoritesStatus.loading) &&
              state.products.isEmpty) {
            return const _FavoritesSkeleton();
          }

          if (state.status == FavoritesStatus.failure &&
              state.products.isEmpty) {
            return _FavoritesStateView(
              icon: Icons.cloud_off_outlined,
              title: localizations.favoritesLoadError,
              message: localizations.favoritesLoadHelp,
              actionLabel: localizations.retry,
              onAction: context.read<FavoritesCubit>().refresh,
            );
          }

          if (state.isEmpty) {
            return _FavoritesStateView(
              icon: Icons.favorite_border,
              title: localizations.noFavoritesTitle,
              message: localizations.noFavoritesSubtitle,
              actionLabel: localizations.browseProducts,
              onAction: () => context.go(AppRoutes.products),
            );
          }

          return RefreshIndicator(
            onRefresh: context.read<FavoritesCubit>().refresh,
            child: CustomScrollView(
              key: const PageStorageKey('favorites-products'),
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.screenPadding,
                      AppSpacing.md,
                      AppSpacing.screenPadding,
                      AppSpacing.sm,
                    ),
                    child: Text(
                      localizations.favoritesCount(state.products.length),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                if (state.hasPartialFailure)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screenPadding,
                      ),
                      child: _PartialFailureBanner(
                        onRetry: context.read<FavoritesCubit>().retryProducts,
                      ),
                    ),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screenPadding,
                    AppSpacing.sm,
                    AppSpacing.screenPadding,
                    AppSpacing.xxl,
                  ),
                  sliver: SliverGrid.builder(
                    gridDelegate: productGridDelegate(context),
                    itemCount: state.products.length,
                    itemBuilder: (context, index) {
                      final product = state.products[index];
                      return ProductGridItem(
                        product: product,
                        onTap: () => context.push(
                          AppRoutes.productDetail(product.id),
                          extra: product,
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FavoritesStateView extends StatelessWidget {
  const _FavoritesStateView({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: (constraints.maxHeight - (AppSpacing.lg * 2))
                .clamp(0, double.infinity)
                .toDouble(),
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 48,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: onAction,
                  icon: Icon(
                    icon == Icons.cloud_off_outlined
                        ? Icons.refresh
                        : Icons.search,
                  ),
                  label: Text(actionLabel),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PartialFailureBanner extends StatelessWidget {
  const _PartialFailureBanner({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: colorScheme.onErrorContainer),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                AppLocalizations.of(context).someFavoritesLoadError,
                style: TextStyle(color: colorScheme.onErrorContainer),
              ),
            ),
            IconButton(
              tooltip: AppLocalizations.of(context).retry,
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
      ),
    );
  }
}

class _FavoritesSkeleton extends StatelessWidget {
  const _FavoritesSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      gridDelegate: productGridDelegate(context),
      itemCount: 4,
      itemBuilder: (context, index) => const ProductCardSkeleton(),
    );
  }
}
