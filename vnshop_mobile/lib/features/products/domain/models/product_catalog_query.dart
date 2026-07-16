import 'package:equatable/equatable.dart';

enum ProductSort {
  popular('popular'),
  newest('newest'),
  priceLowToHigh('price-low'),
  priceHighToLow('price-high');

  const ProductSort(this.apiValue);

  final String apiValue;
}

class ProductCatalogFilters extends Equatable {
  const ProductCatalogFilters({
    this.minPrice,
    this.maxPrice,
    this.sameDayOnly = false,
    this.verifiedOnly = false,
    this.officialOnly = false,
  });

  final double? minPrice;
  final double? maxPrice;
  final bool sameDayOnly;
  final bool verifiedOnly;
  final bool officialOnly;

  bool get hasActiveFilters =>
      minPrice != null ||
      maxPrice != null ||
      sameDayOnly ||
      verifiedOnly ||
      officialOnly;

  int get activeFilterCount => [
    minPrice != null || maxPrice != null,
    sameDayOnly,
    verifiedOnly,
    officialOnly,
  ].where((active) => active).length;

  bool get hasValidPriceRange =>
      (minPrice == null || minPrice! >= 0) &&
      (maxPrice == null || maxPrice! >= 0) &&
      (minPrice == null || maxPrice == null || minPrice! <= maxPrice!);

  @override
  List<Object?> get props => [
    minPrice,
    maxPrice,
    sameDayOnly,
    verifiedOnly,
    officialOnly,
  ];
}
