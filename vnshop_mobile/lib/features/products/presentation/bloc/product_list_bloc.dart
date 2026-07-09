import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/utils/debounce.dart';
import '../../domain/repositories/product_repository.dart';
import 'product_list_event.dart';
import 'product_list_state.dart';

class ProductListBloc extends Bloc<ProductListEvent, ProductListState> {
  final ProductRepository repository;
  static const int _pageSize = 20;

  ProductListBloc({required this.repository}) : super(const ProductListState()) {
    on<LoadProducts>(_onLoadProducts);
    on<LoadMoreProducts>(_onLoadMoreProducts);
    on<SearchProducts>(_onSearchProducts, transformer: debounceRestartable(const Duration(milliseconds: 300)));
    on<ClearSearch>(_onClearSearch);
    on<FilterByCategory>(_onFilterByCategory);
    on<LoadCategories>(_onLoadCategories);
    on<RefreshProducts>(_onRefreshProducts);
  }

  Future<void> _onLoadProducts(
    LoadProducts event,
    Emitter<ProductListState> emit,
  ) async {
    emit(state.copyWith(status: ProductStatus.loading, clearError: true));

    try {
      final products = await repository.getProducts(
        page: 1,
        limit: _pageSize,
        categoryId: state.selectedCategoryId,
        searchQuery: state.searchQuery.isNotEmpty ? state.searchQuery : null,
        forceRefresh: event.forceRefresh,
      );

      emit(state.copyWith(
        status: ProductStatus.success,
        products: products,
        currentPage: 1,
        hasReachedMax: products.length < _pageSize,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: ProductStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onLoadMoreProducts(
    LoadMoreProducts event,
    Emitter<ProductListState> emit,
  ) async {
    if (state.hasReachedMax || state.isLoadingMore) return;

    emit(state.copyWith(status: ProductStatus.loadingMore));

    try {
      final nextPage = state.currentPage + 1;
      final products = await repository.getProducts(
        page: nextPage,
        limit: _pageSize,
        categoryId: state.selectedCategoryId,
        searchQuery: state.searchQuery.isNotEmpty ? state.searchQuery : null,
      );

      emit(state.copyWith(
        status: ProductStatus.success,
        products: [...state.products, ...products],
        currentPage: nextPage,
        hasReachedMax: products.length < _pageSize,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: ProductStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onSearchProducts(
    SearchProducts event,
    Emitter<ProductListState> emit,
  ) async {
    emit(state.copyWith(
      searchQuery: event.query,
      status: ProductStatus.loading,
      clearError: true,
    ));

    try {
      final products = await repository.getProducts(
        page: 1,
        limit: _pageSize,
        categoryId: state.selectedCategoryId,
        searchQuery: event.query.isNotEmpty ? event.query : null,
      );

      emit(state.copyWith(
        status: ProductStatus.success,
        products: products,
        currentPage: 1,
        hasReachedMax: products.length < _pageSize,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: ProductStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onClearSearch(
    ClearSearch event,
    Emitter<ProductListState> emit,
  ) async {
    emit(state.copyWith(
      searchQuery: '',
      status: ProductStatus.loading,
      clearError: true,
    ));

    try {
      final products = await repository.getProducts(
        page: 1,
        limit: _pageSize,
        categoryId: state.selectedCategoryId,
      );

      emit(state.copyWith(
        status: ProductStatus.success,
        products: products,
        currentPage: 1,
        hasReachedMax: products.length < _pageSize,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: ProductStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onFilterByCategory(
    FilterByCategory event,
    Emitter<ProductListState> emit,
  ) async {
    emit(state.copyWith(
      selectedCategoryId: event.categoryId,
      clearSelectedCategory: event.categoryId == null,
      searchQuery: '',
      status: ProductStatus.loading,
      clearError: true,
    ));

    try {
      final products = await repository.getProducts(
        page: 1,
        limit: _pageSize,
        categoryId: event.categoryId,
      );

      emit(state.copyWith(
        status: ProductStatus.success,
        products: products,
        currentPage: 1,
        hasReachedMax: products.length < _pageSize,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: ProductStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }

  Future<void> _onLoadCategories(
    LoadCategories event,
    Emitter<ProductListState> emit,
  ) async {
    try {
      final categories = await repository.getCategories();
      emit(state.copyWith(categories: categories));
    } catch (e) {
      // Silently fail for categories, not critical
    }
  }

  Future<void> _onRefreshProducts(
    RefreshProducts event,
    Emitter<ProductListState> emit,
  ) async {
    try {
      final products = await repository.getProducts(
        page: 1,
        limit: _pageSize,
        categoryId: state.selectedCategoryId,
        searchQuery: state.searchQuery.isNotEmpty ? state.searchQuery : null,
        forceRefresh: true,
      );

      emit(state.copyWith(
        status: ProductStatus.success,
        products: products,
        currentPage: 1,
        hasReachedMax: products.length < _pageSize,
        clearError: true,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: ProductStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }
}
