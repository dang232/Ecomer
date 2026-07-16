import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../home/presentation/widgets/category_chips.dart';
import '../../../home/presentation/widgets/search_bar.dart';
import '../../data/models/category_model.dart';
import '../../domain/models/product_catalog_query.dart';
import '../../domain/repositories/product_repository.dart';
import '../bloc/product_list_bloc.dart';
import '../bloc/product_list_event.dart';
import '../bloc/product_list_state.dart';
import '../widgets/product_filters.dart';
import '../widgets/product_card_skeleton.dart';
import '../widgets/product_grid_item.dart';
import '../widgets/product_grid_layout.dart';

class ProductListPage extends StatefulWidget {
  const ProductListPage({super.key});

  @override
  State<ProductListPage> createState() => _ProductListPageState();
}

class _ProductListPageState extends State<ProductListPage> {
  late final ProductListBloc _products;
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _products = ProductListBloc(repository: context.read<ProductRepository>())
      ..add(const LoadCategories())
      ..add(const LoadProducts());
    _scrollController = ScrollController()..addListener(_loadNextPage);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_loadNextPage)
      ..dispose();
    _products.close();
    super.dispose();
  }

  void _loadNextPage() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 320) {
      _products.add(const LoadMoreProducts());
    }
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

  void _showFilters(ProductCatalogFilters filters) {
    ProductFiltersSheet.show(
      context,
      initialFilters: filters,
      onApply: (value) => _products.add(ApplyProductFilters(value)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return BlocProvider.value(
      value: _products,
      child: Scaffold(
        appBar: AppBar(title: Text(localizations.products)),
        body: BlocBuilder<ProductListBloc, ProductListState>(
          builder: (context, state) => RefreshIndicator(
            onRefresh: _refresh,
            child: CustomScrollView(
              key: const PageStorageKey('product-catalog'),
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                _CatalogSearch(
                  query: state.searchQuery,
                  onSearch: (query) => _products.add(SearchProducts(query)),
                ),
                if (state.categories.isNotEmpty)
                  _CatalogCategories(
                    categories: state.categories,
                    selectedCategoryId: state.selectedCategoryId,
                    onSelected: (categoryId) =>
                        _products.add(FilterByCategory(categoryId)),
                  ),
                _CatalogControls(
                  state: state,
                  onSortChanged: (sort) =>
                      _products.add(ChangeProductSort(sort)),
                  onShowFilters: () => _showFilters(state.filters),
                  onClearFilters: () => _products.add(
                    const ApplyProductFilters(ProductCatalogFilters()),
                  ),
                ),
                ..._resultSlivers(state),
                const SliverPadding(
                  padding: EdgeInsets.only(bottom: AppSpacing.xxl),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _resultSlivers(ProductListState state) {
    final localizations = AppLocalizations.of(context);
    if (state.products.isEmpty &&
        (state.status == ProductStatus.initial ||
            state.status == ProductStatus.loading)) {
      return const [_CatalogSkeleton()];
    }

    if (state.products.isEmpty && state.status == ProductStatus.failure) {
      return [
        _CatalogStateSliver(
          icon: Icons.cloud_off_outlined,
          title: localizations.homeProductsLoadError,
          message: localizations.homeProductsLoadHelp,
          actionLabel: localizations.retry,
          onAction: () => _products.add(const LoadProducts(forceRefresh: true)),
        ),
      ];
    }

    if (state.products.isEmpty && state.status == ProductStatus.success) {
      return [
        _CatalogStateSliver(
          icon: Icons.search_off_outlined,
          title: localizations.noProductsTitle,
          message: localizations.noProductsSubtitle,
          actionLabel: state.filters.hasActiveFilters
              ? localizations.clearFilters
              : null,
          onAction: state.filters.hasActiveFilters
              ? () => _products.add(
                  const ApplyProductFilters(ProductCatalogFilters()),
                )
              : null,
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
            child: _CatalogRetryBanner(
              onRetry: () => _products.add(const RefreshProducts()),
            ),
          ),
        ),
      if (state.status == ProductStatus.loadingMore)
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

class _CatalogSearch extends StatelessWidget {
  const _CatalogSearch({required this.query, required this.onSearch});

  final String query;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenPadding,
          AppSpacing.md,
          AppSpacing.screenPadding,
          AppSpacing.sm,
        ),
        child: HomeSearchBar(
          initialValue: query,
          hintText: AppLocalizations.of(context).searchProducts,
          onSearch: onSearch,
        ),
      ),
    );
  }
}

class _CatalogCategories extends StatelessWidget {
  const _CatalogCategories({
    required this.categories,
    required this.selectedCategoryId,
    required this.onSelected,
  });

  final List<CategoryModel> categories;
  final String? selectedCategoryId;
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
      child: CategoryChips(
        categories: items,
        selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
        onCategorySelected: (index) =>
            onSelected(index == 0 ? null : items[index].id),
      ),
    );
  }
}

class _CatalogControls extends StatelessWidget {
  const _CatalogControls({
    required this.state,
    required this.onSortChanged,
    required this.onShowFilters,
    required this.onClearFilters,
  });

  final ProductListState state;
  final ValueChanged<ProductSort> onSortChanged;
  final VoidCallback onShowFilters;
  final VoidCallback onClearFilters;

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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localizations.productsFound(state.products.length),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _sortLabel(localizations, state.sort),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                if (state.filters.hasActiveFilters)
                  IconButton(
                    tooltip: localizations.clearFilters,
                    onPressed: onClearFilters,
                    icon: const Icon(Icons.filter_alt_off_outlined),
                  ),
                PopupMenuButton<ProductSort>(
                  tooltip: localizations.sortProducts,
                  initialValue: state.sort,
                  onSelected: onSortChanged,
                  icon: const Icon(Icons.sort),
                  itemBuilder: (context) =>
                      [
                            ProductSort.newest,
                            ProductSort.priceLowToHigh,
                            ProductSort.priceHighToLow,
                          ]
                          .map(
                            (sort) => PopupMenuItem(
                              value: sort,
                              child: Text(_sortLabel(localizations, sort)),
                            ),
                          )
                          .toList(),
                ),
                Badge(
                  isLabelVisible: state.filters.hasActiveFilters,
                  label: Text('${state.filters.activeFilterCount}'),
                  child: IconButton(
                    tooltip: localizations.filters,
                    onPressed: onShowFilters,
                    icon: const Icon(Icons.tune),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _sortLabel(AppLocalizations localizations, ProductSort sort) {
    return switch (sort) {
      ProductSort.newest || ProductSort.popular => localizations.sortNewest,
      ProductSort.priceLowToHigh => localizations.sortPriceLowToHigh,
      ProductSort.priceHighToLow => localizations.sortPriceHighToLow,
    };
  }
}

class _CatalogStateSliver extends StatelessWidget {
  const _CatalogStateSliver({
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
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: onAction,
                  icon: Icon(
                    icon == Icons.cloud_off_outlined
                        ? Icons.refresh
                        : Icons.filter_alt_off_outlined,
                  ),
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

class _CatalogSkeleton extends StatelessWidget {
  const _CatalogSkeleton();

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

class _CatalogRetryBanner extends StatelessWidget {
  const _CatalogRetryBanner({required this.onRetry});

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
                AppLocalizations.of(context).someProductsLoadError,
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
