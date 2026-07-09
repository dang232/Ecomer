import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/product_model.dart';
import '../../domain/repositories/product_repository.dart';
import '../bloc/product_list_bloc.dart';
import '../bloc/product_list_event.dart';
import '../bloc/product_list_state.dart';
import '../widgets/product_grid_item.dart';
import '../widgets/product_filters.dart';

/// Product listing page with search, filters, and grid view
class ProductListPage extends StatefulWidget {
  const ProductListPage({super.key});

  @override
  State<ProductListPage> createState() => _ProductListPageState();
}

class _ProductListPageState extends State<ProductListPage>
    with TickerProviderStateMixin {
  late final ProductListBloc _bloc;
  late final ScrollController _scrollController;
  late final TextEditingController _searchController;

  // Debounce timer for search
  Timer? _debounceTimer;

  // Animation controllers
  late AnimationController _staggerController;
  late Animation<double> _staggerAnimation;

  // Sort options
  static const List<Map<String, String>> _sortOptions = [
    {'value': 'newest', 'label': 'Mới nhất'},
    {'value': 'price_asc', 'label': 'Giá thấp - cao'},
    {'value': 'price_desc', 'label': 'Giá cao - thấp'},
    {'value': 'bestseller', 'label': 'Bán chạy'},
    {'value': 'rating', 'label': 'Đánh giá cao'},
  ];

  String _currentSort = 'newest';
  ProductFilterOptions _filters = const ProductFilterOptions();

  @override
  void initState() {
    super.initState();
    _bloc = ProductListBloc(
      repository: context.read<ProductRepository>(),
    );
    _bloc.add(const LoadCategories());
    _bloc.add(const LoadProducts());
    
    _scrollController = ScrollController()..addListener(_onScroll);
    _searchController = TextEditingController();

    // Initialize stagger animation
    _staggerController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _staggerAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _staggerController,
        curve: const Interval(0.0, 0.8, curve: Curves.easeOut),
      ),
    );

    // Start animation
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) {
        _staggerController.forward();
      }
    });
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _scrollController.dispose();
    _searchController.dispose();
    _staggerController.dispose();
    _bloc.close();
    super.dispose();
  }

  void _onScroll() {
    if (_isBottom) {
      _bloc.add(const LoadMoreProducts());
    }
  }

  bool get _isBottom {
    if (!_scrollController.hasClients) return false;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    return currentScroll >= (maxScroll * 0.9);
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      _bloc.add(SearchProducts(query));
    });
  }

  void _onClearSearch() {
    _searchController.clear();
    _bloc.add(const ClearSearch());
  }

  void _onSortChanged(String? value) {
    if (value != null) {
      setState(() {
        _currentSort = value;
      });
      // Trigger reload with sort
      _bloc.add(const RefreshProducts());
    }
  }

  void _showFilters() {
    ProductFiltersSheet.show(
      context,
      initialFilters: _filters,
      onApply: (filters) {
        setState(() {
          _filters = filters;
        });
        // Trigger reload with filters
        _bloc.add(const RefreshProducts());
      },
    );
  }

  void _navigateToDetail(ProductModel product) {
    context.push('/products/${product.id}', extra: product);
  }

  Future<void> _onRefresh() async {
    _staggerController.reset();
    _bloc.add(const RefreshProducts());
    await Future.delayed(const Duration(milliseconds: 500));
    _staggerController.forward();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return BlocProvider.value(
      value: _bloc,
      child: Scaffold(
        backgroundColor: theme.colorScheme.surface,
        appBar: AppBar(
          title: const Text('Sản phẩm'),
          centerTitle: true,
          elevation: 0,
          scrolledUnderElevation: 1,
        ),
        body: Column(
          children: [
            // Search and filter bar
            _buildSearchBar(),

            // Category chips
            _buildCategoryChips(),

            // Sort bar
            _buildSortBar(),

            // Product grid
            Expanded(
              child: BlocBuilder<ProductListBloc, ProductListState>(
                builder: (context, state) {
                  if (state.status == ProductStatus.initial ||
                      (state.status == ProductStatus.loading &&
                          state.products.isEmpty)) {
                    return const Center(
                      child: CircularProgressIndicator(),
                    );
                  }

                  if (state.hasError && state.products.isEmpty) {
                    return _buildErrorWidget(state.errorMessage);
                  }

                  if (state.isEmpty) {
                    return _buildEmptyWidget();
                  }

                  return AnimatedBuilder(
                    animation: _staggerAnimation,
                    builder: (context, child) => Opacity(
                      opacity: _staggerAnimation.value,
                      child: child,
                    ),
                    child: RefreshIndicator(
                      onRefresh: _onRefresh,
                      child: GridView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.6,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                        itemCount:
                            state.products.length + (state.isLoadingMore ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index >= state.products.length) {
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            );
                          }

                          final product = state.products[index];
                          return ProductGridItem(
                            product: product,
                            onTap: () => _navigateToDetail(product),
                          );
                        },
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final theme = Theme.of(context);

    return AnimatedBuilder(
      animation: _staggerAnimation,
      builder: (context, child) => Opacity(
        opacity: _staggerAnimation.value,
        child: Transform.translate(
          offset: Offset(0, 12 * (1 - _staggerAnimation.value)),
          child: child,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest.withAlpha(128),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm sản phẩm...',
                    prefixIcon: Icon(
                      Icons.search,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    suffixIcon: BlocBuilder<ProductListBloc, ProductListState>(
                      buildWhen: (prev, curr) =>
                          prev.searchQuery != curr.searchQuery,
                      builder: (context, state) {
                        if (state.searchQuery.isNotEmpty) {
                          return IconButton(
                            icon: Icon(
                              Icons.clear,
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                            onPressed: _onClearSearch,
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Filter button with badge
            BlocBuilder<ProductListBloc, ProductListState>(
              buildWhen: (prev, curr) => prev.status != curr.status,
              builder: (context, state) {
                return _FilterButton(
                  hasFilters: _filters.hasActiveFilters,
                  onTap: _showFilters,
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return BlocBuilder<ProductListBloc, ProductListState>(
      buildWhen: (previous, current) =>
          previous.categories != current.categories ||
          previous.selectedCategoryId != current.selectedCategoryId ||
          previous.status != current.status,
      builder: (context, state) {
        if (state.categories.isEmpty &&
            state.status == ProductStatus.loading) {
          return const SizedBox(
            height: 40,
            child: Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          );
        }

        return SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: state.categories.length + 1,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              if (index == 0) {
                return _CategoryChip(
                  label: 'Tất cả',
                  isSelected: state.selectedCategoryId == null,
                  onTap: () => _bloc.add(const FilterByCategory(null)),
                );
              }

              final category = state.categories[index - 1];
              return _CategoryChip(
                label: category.name,
                isSelected: state.selectedCategoryId == category.id,
                onTap: () => _bloc.add(FilterByCategory(category.id)),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildSortBar() {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          BlocBuilder<ProductListBloc, ProductListState>(
            builder: (context, state) {
              return Text(
                '${state.products.length} sản phẩm',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              );
            },
          ),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _currentSort,
              isDense: true,
              icon: Icon(
                Icons.sort,
                size: 20,
                color: theme.colorScheme.onSurfaceVariant,
              ),
              items: _sortOptions.map((option) {
                return DropdownMenuItem<String>(
                  value: option['value'],
                  child: Text(
                    option['label']!,
                    style: theme.textTheme.bodyMedium,
                  ),
                );
              }).toList(),
              onChanged: _onSortChanged,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget(String? message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Đã xảy ra lỗi',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message ?? 'Vui lòng thử lại sau',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _bloc.add(const LoadProducts(forceRefresh: true)),
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Không tìm thấy sản phẩm',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Hãy thử tìm kiếm với từ khóa khác\nhoặc điều chỉnh bộ lọc',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton(
                  onPressed: _showFilters,
                  child: const Text('Điều chỉnh bộ lọc'),
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: _onClearSearch,
                  child: const Text('Xóa tìm kiếm'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Category chip widget
class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? theme.colorScheme.primary
              : theme.colorScheme.surfaceContainerHighest.withAlpha(128),
          borderRadius: BorderRadius.circular(20),
          border: isSelected
              ? null
              : Border.all(
                  color: theme.colorScheme.outline.withValues(alpha: 0.3),
                ),
        ),
        child: Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: isSelected
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurface,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

/// Filter button with animation
class _FilterButton extends StatefulWidget {
  const _FilterButton({
    required this.hasFilters,
    required this.onTap,
  });

  final bool hasFilters;
  final VoidCallback onTap;

  @override
  State<_FilterButton> createState() => _FilterButtonState();
}

class _FilterButtonState extends State<_FilterButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.92).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onTap();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: widget.hasFilters
                ? theme.colorScheme.primary.withValues(alpha: 0.1)
                : theme.colorScheme.surfaceContainerHighest.withAlpha(128),
            borderRadius: BorderRadius.circular(12),
            border: widget.hasFilters
                ? Border.all(
                    color: theme.colorScheme.primary,
                    width: 1.5,
                  )
                : Border.all(
                    color: theme.colorScheme.outline.withValues(alpha: 0.3),
                  ),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(
                Icons.tune,
                color: widget.hasFilters
                    ? theme.colorScheme.primary
                    : theme.colorScheme.onSurfaceVariant,
              ),
              if (widget.hasFilters)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
