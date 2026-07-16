import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../products/data/models/category_model.dart';
import '../../../products/domain/repositories/product_repository.dart';
import '../../../products/presentation/bloc/product_list_bloc.dart';
import '../../../products/presentation/bloc/product_list_event.dart';
import '../../../products/presentation/bloc/product_list_state.dart';
import '../../../products/presentation/widgets/product_card_skeleton.dart';
import '../../../products/presentation/widgets/product_grid_item.dart';
import '../../../products/presentation/widgets/product_grid_layout.dart';
import '../widgets/category_chips.dart';
import '../widgets/search_bar.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final ProductListBloc _products;

  @override
  void initState() {
    super.initState();
    _products = ProductListBloc(repository: context.read<ProductRepository>())
      ..add(const LoadCategories())
      ..add(const LoadProducts());
  }

  @override
  void dispose() {
    _products.close();
    super.dispose();
  }

  Future<void> _refresh() async {
    final completed = _products.stream.firstWhere(
      (state) =>
          state.status == ProductStatus.success ||
          state.status == ProductStatus.failure,
    );
    _products.add(const RefreshProducts());
    await completed;
  }

  void _search(String query) => _products.add(SearchProducts(query.trim()));

  void _selectCategory(String? categoryId) {
    _products.add(FilterByCategory(categoryId));
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _products,
      child: Scaffold(
        backgroundColor: Theme.of(context).colorScheme.surface,
        body: SafeArea(
          child: BlocBuilder<ProductListBloc, ProductListState>(
            builder: (context, state) {
              return RefreshIndicator(
                onRefresh: _refresh,
                child: CustomScrollView(
                  key: const PageStorageKey('home-products'),
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    _HomeHeader(onSearch: _search),
                    _CategoryStrip(
                      categories: state.categories,
                      selectedCategoryId: state.selectedCategoryId,
                      isLoading: state.status == ProductStatus.loading,
                      onSelected: _selectCategory,
                    ),
                    _ProductHeading(count: state.products.length),
                    ..._productSlivers(state),
                    const SliverPadding(
                      padding: EdgeInsets.only(bottom: AppSpacing.xxl),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _productSlivers(ProductListState state) {
    if (state.products.isEmpty &&
        (state.status == ProductStatus.initial ||
            state.status == ProductStatus.loading)) {
      return const [_ProductSkeletonGrid()];
    }

    if (state.products.isEmpty && state.status == ProductStatus.failure) {
      return [
        _HomeStateSliver(
          icon: Icons.cloud_off_outlined,
          title: AppLocalizations.of(context).homeProductsLoadError,
          message: AppLocalizations.of(context).homeProductsLoadHelp,
          actionLabel: AppLocalizations.of(context).retry,
          onAction: () => _products.add(const LoadProducts(forceRefresh: true)),
        ),
      ];
    }

    if (state.products.isEmpty && state.status == ProductStatus.success) {
      return [
        _HomeStateSliver(
          icon: Icons.search_off_outlined,
          title: AppLocalizations.of(context).noProductsTitle,
          message: AppLocalizations.of(context).noProductsSubtitle,
        ),
      ];
    }

    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenPadding,
          AppSpacing.sm,
          AppSpacing.screenPadding,
          AppSpacing.lg,
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
      if (state.status == ProductStatus.failure)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenPadding,
            ),
            child: _InlineRetry(
              message: AppLocalizations.of(context).homeProductsLoadError,
              onRetry: () => _products.add(const RefreshProducts()),
            ),
          ),
        ),
      if (state.isLoadingMore)
        const SliverToBoxAdapter(
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: CircularProgressIndicator(),
            ),
          ),
        ),
    ];
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.onSearch});

  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenPadding,
          AppSpacing.md,
          AppSpacing.screenPadding,
          AppSpacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    localizations.appTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: localizations.favorites,
                  onPressed: () => context.push(AppRoutes.favorites),
                  icon: const Icon(Icons.favorite_border),
                ),
                IconButton(
                  tooltip: localizations.notifications,
                  onPressed: () => context.push(AppRoutes.notifications),
                  icon: const Icon(Icons.notifications_outlined),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            HomeSearchBar(
              onSearch: onSearch,
              hintText: localizations.searchProducts,
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryStrip extends StatelessWidget {
  const _CategoryStrip({
    required this.categories,
    required this.selectedCategoryId,
    required this.isLoading,
    required this.onSelected,
  });

  final List<CategoryModel> categories;
  final String? selectedCategoryId;
  final bool isLoading;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final items = [
      CategoryChipData(
        id: '',
        name: AppLocalizations.of(context).allCategories,
        icon: Icons.apps_outlined,
      ),
      ...categories
          .where((category) => category.isActive && category.name.isNotEmpty)
          .map(
            (category) =>
                CategoryChipData(id: category.id, name: category.name),
          ),
    ];
    final selectedIndex = selectedCategoryId == null
        ? 0
        : items.indexWhere((category) => category.id == selectedCategoryId);

    return SliverToBoxAdapter(
      child: isLoading && categories.isEmpty
          ? const _CategorySkeleton()
          : Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: CategoryChips(
                categories: items,
                selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
                onCategorySelected: (index) {
                  onSelected(index == 0 ? null : items[index].id);
                },
              ),
            ),
    );
  }
}

class _ProductHeading extends StatelessWidget {
  const _ProductHeading({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenPadding,
          AppSpacing.sm,
          AppSpacing.screenPadding,
          0,
        ),
        child: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            Text(
              localizations.browseProducts,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (count > 0)
              Text(
                localizations.productsFound(count),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProductSkeletonGrid extends StatelessWidget {
  const _ProductSkeletonGrid();

  @override
  Widget build(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      sliver: SliverGrid.builder(
        gridDelegate: productGridDelegate(context),
        itemCount: 4,
        itemBuilder: (context, index) => const ProductCardSkeleton(),
      ),
    );
  }
}

class _CategorySkeleton extends StatelessWidget {
  const _CategorySkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return SizedBox(
      height: 56,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.screenPadding,
        ),
        itemCount: 4,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) => Container(
          width: 96,
          margin: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(24),
          ),
        ),
      ),
    );
  }
}

class _HomeStateSliver extends StatelessWidget {
  const _HomeStateSliver({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 40,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: AppSpacing.md),
                FilledButton.icon(
                  onPressed: onAction,
                  icon: const Icon(Icons.refresh),
                  label: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _InlineRetry extends StatelessWidget {
  const _InlineRetry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          children: [
            Icon(
              Icons.error_outline,
              color: Theme.of(context).colorScheme.onErrorContainer,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(child: Text(message)),
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
