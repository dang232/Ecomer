import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/repositories/product_repository.dart';
import 'product_list_event.dart';
import 'product_list_state.dart';

class ProductListBloc extends Bloc<ProductListEvent, ProductListState> {
  ProductListBloc({required this.repository})
    : super(const ProductListState()) {
    on<LoadProducts>(_onLoadProducts);
    on<LoadMoreProducts>(_onLoadMoreProducts);
    on<SearchProducts>(_onSearchProducts);
    on<ClearSearch>(_onClearSearch);
    on<FilterByCategory>(_onFilterByCategory);
    on<LoadCategories>(_onLoadCategories);
    on<RefreshProducts>(_onRefreshProducts);
    on<ApplyProductFilters>(_onApplyFilters);
    on<ChangeProductSort>(_onChangeSort);
  }

  final ProductRepository repository;
  static const int _pageSize = 20;
  int _requestVersion = 0;

  Future<void> _onLoadProducts(
    LoadProducts event,
    Emitter<ProductListState> emit,
  ) =>
      _loadFirstPage(emit, queryState: state, forceRefresh: event.forceRefresh);

  Future<void> _onSearchProducts(
    SearchProducts event,
    Emitter<ProductListState> emit,
  ) => _loadFirstPage(
    emit,
    queryState: state.copyWith(searchQuery: event.query.trim()),
  );

  Future<void> _onClearSearch(
    ClearSearch event,
    Emitter<ProductListState> emit,
  ) => _loadFirstPage(emit, queryState: state.copyWith(searchQuery: ''));

  Future<void> _onFilterByCategory(
    FilterByCategory event,
    Emitter<ProductListState> emit,
  ) => _loadFirstPage(
    emit,
    queryState: state.copyWith(
      selectedCategoryId: event.categoryId,
      clearSelectedCategory: event.categoryId == null,
    ),
  );

  Future<void> _onApplyFilters(
    ApplyProductFilters event,
    Emitter<ProductListState> emit,
  ) async {
    if (!event.filters.hasValidPriceRange) {
      emit(
        state.copyWith(
          status: ProductStatus.failure,
          errorMessage: 'invalid_price_range',
        ),
      );
      return;
    }
    await _loadFirstPage(
      emit,
      queryState: state.copyWith(filters: event.filters),
    );
  }

  Future<void> _onChangeSort(
    ChangeProductSort event,
    Emitter<ProductListState> emit,
  ) => _loadFirstPage(emit, queryState: state.copyWith(sort: event.sort));

  Future<void> _onRefreshProducts(
    RefreshProducts event,
    Emitter<ProductListState> emit,
  ) => _loadFirstPage(emit, queryState: state, forceRefresh: true);

  Future<void> _loadFirstPage(
    Emitter<ProductListState> emit, {
    required ProductListState queryState,
    bool forceRefresh = false,
  }) async {
    final requestVersion = ++_requestVersion;
    emit(queryState.copyWith(status: ProductStatus.loading, clearError: true));

    try {
      final products = await repository.getProducts(
        page: 1,
        limit: _pageSize,
        categoryId: queryState.selectedCategoryId,
        searchQuery: queryState.searchQuery.isEmpty
            ? null
            : queryState.searchQuery,
        filters: queryState.filters,
        sort: queryState.sort,
        forceRefresh: forceRefresh,
      );
      if (requestVersion != _requestVersion || emit.isDone) return;

      emit(
        state.copyWith(
          status: ProductStatus.success,
          products: products,
          currentPage: 1,
          hasReachedMax: products.length < _pageSize,
          clearError: true,
        ),
      );
    } catch (error) {
      if (requestVersion != _requestVersion || emit.isDone) return;
      emit(
        state.copyWith(
          status: ProductStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> _onLoadMoreProducts(
    LoadMoreProducts event,
    Emitter<ProductListState> emit,
  ) async {
    if (state.status != ProductStatus.success || state.hasReachedMax) return;

    final requestVersion = ++_requestVersion;
    final queryState = state;
    emit(state.copyWith(status: ProductStatus.loadingMore));

    try {
      final nextPage = queryState.currentPage + 1;
      final products = await repository.getProducts(
        page: nextPage,
        limit: _pageSize,
        categoryId: queryState.selectedCategoryId,
        searchQuery: queryState.searchQuery.isEmpty
            ? null
            : queryState.searchQuery,
        filters: queryState.filters,
        sort: queryState.sort,
      );
      if (requestVersion != _requestVersion || emit.isDone) return;

      emit(
        state.copyWith(
          status: ProductStatus.success,
          products: [...queryState.products, ...products],
          currentPage: nextPage,
          hasReachedMax: products.length < _pageSize,
          clearError: true,
        ),
      );
    } catch (error) {
      if (requestVersion != _requestVersion || emit.isDone) return;
      emit(
        state.copyWith(
          status: ProductStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> _onLoadCategories(
    LoadCategories event,
    Emitter<ProductListState> emit,
  ) async {
    try {
      final categories = await repository.getCategories();
      emit(state.copyWith(categories: categories));
    } catch (_) {
      // Product results remain usable when optional category metadata fails.
    }
  }
}
