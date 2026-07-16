import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/products/domain/models/product_catalog_query.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/products/presentation/bloc/product_list_bloc.dart';
import 'package:vnshop_mobile/features/products/presentation/bloc/product_list_event.dart';
import 'package:vnshop_mobile/features/products/presentation/bloc/product_list_state.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository repository;

  setUpAll(() {
    registerFallbackValue(const ProductCatalogFilters());
    registerFallbackValue(ProductSort.popular);
  });

  setUp(() {
    repository = MockProductRepository();
    when(
      () => repository.getProducts(
        page: any(named: 'page'),
        limit: any(named: 'limit'),
        categoryId: any(named: 'categoryId'),
        searchQuery: any(named: 'searchQuery'),
        filters: any(named: 'filters'),
        sort: any(named: 'sort'),
        forceRefresh: any(named: 'forceRefresh'),
      ),
    ).thenAnswer((_) async => const []);
  });

  blocTest<ProductListBloc, ProductListState>(
    'applies catalog filters through the repository query',
    build: () => ProductListBloc(repository: repository),
    act: (bloc) => bloc.add(
      const ApplyProductFilters(
        ProductCatalogFilters(
          minPrice: 100000,
          maxPrice: 500000,
          verifiedOnly: true,
        ),
      ),
    ),
    expect: () => [
      isA<ProductListState>()
          .having((state) => state.status, 'status', ProductStatus.loading)
          .having((state) => state.filters.minPrice, 'minimum price', 100000)
          .having((state) => state.filters.verifiedOnly, 'verified', isTrue),
      isA<ProductListState>().having(
        (state) => state.status,
        'status',
        ProductStatus.success,
      ),
    ],
    verify: (_) => verify(
      () => repository.getProducts(
        page: 1,
        limit: 20,
        categoryId: null,
        searchQuery: null,
        filters: const ProductCatalogFilters(
          minPrice: 100000,
          maxPrice: 500000,
          verifiedOnly: true,
        ),
        sort: ProductSort.newest,
        forceRefresh: false,
      ),
    ).called(1),
  );

  blocTest<ProductListBloc, ProductListState>(
    'applies server-backed sorting through the repository query',
    build: () => ProductListBloc(repository: repository),
    act: (bloc) =>
        bloc.add(const ChangeProductSort(ProductSort.priceHighToLow)),
    expect: () => [
      isA<ProductListState>()
          .having((state) => state.status, 'status', ProductStatus.loading)
          .having((state) => state.sort, 'sort', ProductSort.priceHighToLow),
      isA<ProductListState>().having(
        (state) => state.status,
        'status',
        ProductStatus.success,
      ),
    ],
    verify: (_) => verify(
      () => repository.getProducts(
        page: 1,
        limit: 20,
        categoryId: null,
        searchQuery: null,
        filters: const ProductCatalogFilters(),
        sort: ProductSort.priceHighToLow,
        forceRefresh: false,
      ),
    ).called(1),
  );
}
