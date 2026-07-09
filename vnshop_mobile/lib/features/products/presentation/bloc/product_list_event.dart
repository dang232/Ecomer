import 'package:equatable/equatable.dart';

abstract class ProductListEvent extends Equatable {
  const ProductListEvent();

  @override
  List<Object?> get props => [];
}

class LoadProducts extends ProductListEvent {
  final bool forceRefresh;

  const LoadProducts({this.forceRefresh = false});

  @override
  List<Object?> get props => [forceRefresh];
}

class LoadMoreProducts extends ProductListEvent {
  const LoadMoreProducts();
}

class SearchProducts extends ProductListEvent {
  final String query;

  const SearchProducts(this.query);

  @override
  List<Object?> get props => [query];
}

class ClearSearch extends ProductListEvent {
  const ClearSearch();
}

class FilterByCategory extends ProductListEvent {
  final String? categoryId;

  const FilterByCategory(this.categoryId);

  @override
  List<Object?> get props => [categoryId];
}

class LoadCategories extends ProductListEvent {
  const LoadCategories();
}

class RefreshProducts extends ProductListEvent {
  const RefreshProducts();
}
