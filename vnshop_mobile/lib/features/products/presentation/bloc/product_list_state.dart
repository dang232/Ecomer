import 'package:equatable/equatable.dart';
import '../../data/models/product_model.dart';
import '../../data/models/category_model.dart';

enum ProductStatus { initial, loading, success, failure, loadingMore }

class ProductListState extends Equatable {
  final ProductStatus status;
  final List<ProductModel> products;
  final List<CategoryModel> categories;
  final String? selectedCategoryId;
  final String searchQuery;
  final int currentPage;
  final bool hasReachedMax;
  final String? errorMessage;

  const ProductListState({
    this.status = ProductStatus.initial,
    this.products = const [],
    this.categories = const [],
    this.selectedCategoryId,
    this.searchQuery = '',
    this.currentPage = 1,
    this.hasReachedMax = false,
    this.errorMessage,
  });

  bool get isLoading => status == ProductStatus.loading;
  bool get isLoadingMore => status == ProductStatus.loadingMore;
  bool get hasError => status == ProductStatus.failure;
  bool get isEmpty => products.isEmpty && status == ProductStatus.success;

  ProductListState copyWith({
    ProductStatus? status,
    List<ProductModel>? products,
    List<CategoryModel>? categories,
    String? selectedCategoryId,
    bool clearSelectedCategory = false,
    String? searchQuery,
    int? currentPage,
    bool? hasReachedMax,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ProductListState(
      status: status ?? this.status,
      products: products ?? this.products,
      categories: categories ?? this.categories,
      selectedCategoryId: clearSelectedCategory ? null : (selectedCategoryId ?? this.selectedCategoryId),
      searchQuery: searchQuery ?? this.searchQuery,
      currentPage: currentPage ?? this.currentPage,
      hasReachedMax: hasReachedMax ?? this.hasReachedMax,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [
        status,
        products,
        categories,
        selectedCategoryId,
        searchQuery,
        currentPage,
        hasReachedMax,
        errorMessage,
      ];
}
