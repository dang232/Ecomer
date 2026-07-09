import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/data/models/category_model.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/products/presentation/bloc/product_list_bloc.dart';
import 'package:vnshop_mobile/features/products/presentation/bloc/product_list_event.dart';
import 'package:vnshop_mobile/features/products/presentation/bloc/product_list_state.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository mockRepository;

  final testProducts = List.generate(
    20,
    (index) => ProductModel(
      id: 'prod_$index',
      name: 'Test Product $index',
      description: 'Description for product $index',
      price: 125000.0 + (index * 1000),
      imageUrl: 'https://example.com/image$index.jpg',
      stock: 10 + index,
      categoryId: 'cat_1',
      categoryName: 'Test Category',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ),
  );

  final testProductsPage2 = List.generate(
    10,
    (index) => ProductModel(
      id: 'prod_page2_$index',
      name: 'Test Product Page 2 $index',
      description: 'Description for product page 2 $index',
      price: 125000.0 + (index * 1000),
      imageUrl: 'https://example.com/image_page2_$index.jpg',
      stock: 10 + index,
      categoryId: 'cat_1',
      categoryName: 'Test Category',
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ),
  );

  final testCategories = [
    const CategoryModel(
      id: 'cat_1',
      name: 'Category 1',
      description: 'First category',
    ),
    const CategoryModel(
      id: 'cat_2',
      name: 'Category 2',
      description: 'Second category',
    ),
  ];

  setUp(() {
    mockRepository = MockProductRepository();
  });

  group('ProductListBloc', () {
    group('LoadProducts', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [loading, success] with products when load succeeds',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts);
          return ProductListBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const LoadProducts()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.loading)
              .having((s) => s.errorMessage, 'errorMessage', isNull),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.products.length, 'products.length', 20)
              .having((s) => s.currentPage, 'currentPage', 1)
              .having((s) => s.hasReachedMax, 'hasReachedMax', false),
        ],
        verify: (_) {
          verify(() => mockRepository.getProducts(
                page: 1,
                limit: 20,
                categoryId: null,
                searchQuery: null,
                forceRefresh: false,
              )).called(1);
        },
      );

      blocTest<ProductListBloc, ProductListState>(
        'emits [loading, success with hasReachedMax=true] when fewer products returned than page size',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts.take(10).toList());
          return ProductListBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const LoadProducts()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.products.length, 'products.length', 10)
              .having((s) => s.hasReachedMax, 'hasReachedMax', true),
        ],
      );

      blocTest<ProductListBloc, ProductListState>(
        'emits [loading, failure] when load fails',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenThrow(Exception('Network error'));
          return ProductListBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const LoadProducts()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.failure)
              .having((s) => s.errorMessage, 'errorMessage', isNotNull),
        ],
      );
    });

    group('LoadMoreProducts (Pagination)', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [loadingMore, success] with more products when load more succeeds',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProductsPage2);
          return ProductListBloc(repository: mockRepository);
        },
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: testProducts,
          currentPage: 1,
          hasReachedMax: false,
        ),
        act: (bloc) => bloc.add(const LoadMoreProducts()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.loadingMore),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.products.length, 'products.length', 30)
              .having((s) => s.currentPage, 'currentPage', 2),
        ],
        verify: (_) {
          verify(() => mockRepository.getProducts(
                page: 2,
                limit: 20,
                categoryId: null,
                searchQuery: null,
                forceRefresh: false,
              )).called(1);
        },
      );

      blocTest<ProductListBloc, ProductListState>(
        'does not emit when hasReachedMax is true',
        build: () => ProductListBloc(repository: mockRepository),
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: testProducts.take(10).toList(),
          currentPage: 1,
          hasReachedMax: true,
        ),
        act: (bloc) => bloc.add(const LoadMoreProducts()),
        expect: () => [],
        verify: (_) {
          verifyNever(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              ));
        },
      );

      blocTest<ProductListBloc, ProductListState>(
        'does not emit when already loading more',
        build: () => ProductListBloc(repository: mockRepository),
        seed: () => ProductListState(
          status: ProductStatus.loadingMore,
          products: testProducts,
          currentPage: 1,
          hasReachedMax: false,
        ),
        act: (bloc) => bloc.add(const LoadMoreProducts()),
        expect: () => [],
      );
    });

    group('Search with Debounce', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [loading, success] with search results after debounce',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts.take(5).toList());
          return ProductListBloc(repository: mockRepository);
        },
        act: (bloc) async {
          bloc.add(const SearchProducts('test'));
          await Future.delayed(const Duration(milliseconds: 350));
        },
        wait: const Duration(milliseconds: 400),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.searchQuery, 'searchQuery', 'test')
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.products.length, 'products.length', 5),
        ],
        verify: (_) {
          verify(() => mockRepository.getProducts(
                page: 1,
                limit: 20,
                categoryId: null,
                searchQuery: 'test',
                forceRefresh: false,
              )).called(1);
        },
      );

      test('debounce cancellation - rapid searches only trigger last one', () async {
        var callCount = 0;
        when(() => mockRepository.getProducts(
              page: any(named: 'page'),
              limit: any(named: 'limit'),
              categoryId: any(named: 'categoryId'),
              searchQuery: any(named: 'searchQuery'),
              forceRefresh: any(named: 'forceRefresh'),
            )).thenAnswer((_) async {
          callCount++;
          return testProducts.take(5).toList();
        });

        final bloc = ProductListBloc(repository: mockRepository);

        // Simulate rapid search inputs
        bloc.add(const SearchProducts('a'));
        await Future.delayed(const Duration(milliseconds: 100));
        bloc.add(const SearchProducts('ab'));
        await Future.delayed(const Duration(milliseconds: 100));
        bloc.add(const SearchProducts('abc'));
        await Future.delayed(const Duration(milliseconds: 400)); // Wait for debounce

        expect(callCount, 1);

        await bloc.close();
      });
    });

    group('Filter by Category', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [loading, success] with filtered products when filter succeeds',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts.take(10).toList());
          return ProductListBloc(repository: mockRepository);
        },
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: testProducts,
          searchQuery: '',
        ),
        act: (bloc) => bloc.add(const FilterByCategory('cat_1')),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.selectedCategoryId, 'selectedCategoryId', 'cat_1')
              .having((s) => s.searchQuery, 'searchQuery', '')
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.selectedCategoryId, 'selectedCategoryId', 'cat_1')
              .having((s) => s.products.length, 'products.length', 10),
        ],
        verify: (_) {
          verify(() => mockRepository.getProducts(
                page: 1,
                limit: 20,
                categoryId: 'cat_1',
                searchQuery: null,
                forceRefresh: false,
              )).called(1);
        },
      );

      blocTest<ProductListBloc, ProductListState>(
        'clears search query when filtering by category',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts);
          return ProductListBloc(repository: mockRepository);
        },
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: testProducts,
          searchQuery: 'previous search',
        ),
        act: (bloc) => bloc.add(const FilterByCategory('cat_1')),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.searchQuery, 'searchQuery', '')
              .having((s) => s.selectedCategoryId, 'selectedCategoryId', 'cat_1')
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success),
        ],
      );

      blocTest<ProductListBloc, ProductListState>(
        'clears category filter when null category passed',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts);
          return ProductListBloc(repository: mockRepository);
        },
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: testProducts,
          selectedCategoryId: 'cat_1',
        ),
        act: (bloc) => bloc.add(const FilterByCategory(null)),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.selectedCategoryId, 'selectedCategoryId', isNull)
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success),
        ],
      );
    });

    group('LoadCategories', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [success] with categories when load succeeds',
        build: () {
          when(() => mockRepository.getCategories(
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testCategories);
          return ProductListBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const LoadCategories()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.categories.length, 'categories.length', 2)
              .having((s) => s.categories.first.name, 'first category name', 'Category 1'),
        ],
        verify: (_) {
          verify(() => mockRepository.getCategories(forceRefresh: false)).called(1);
        },
      );

      blocTest<ProductListBloc, ProductListState>(
        'does not emit error state when categories load fails (non-critical)',
        build: () {
          when(() => mockRepository.getCategories(
                forceRefresh: any(named: 'forceRefresh'),
              )).thenThrow(Exception('Categories error'));
          return ProductListBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const LoadCategories()),
        expect: () => [],
      );
    });

    group('RefreshProducts', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [success] with refreshed products when refresh succeeds',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts);
          return ProductListBloc(repository: mockRepository);
        },
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: [],
        ),
        act: (bloc) => bloc.add(const RefreshProducts()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.products.length, 'products.length', 20)
              .having((s) => s.errorMessage, 'errorMessage', isNull),
        ],
        verify: (_) {
          verify(() => mockRepository.getProducts(
                page: 1,
                limit: 20,
                categoryId: null,
                searchQuery: null,
                forceRefresh: true,
              )).called(1);
        },
      );
    });

    group('ClearSearch', () {
      blocTest<ProductListBloc, ProductListState>(
        'emits [loading, success] with all products when clear search succeeds',
        build: () {
          when(() => mockRepository.getProducts(
                page: any(named: 'page'),
                limit: any(named: 'limit'),
                categoryId: any(named: 'categoryId'),
                searchQuery: any(named: 'searchQuery'),
                forceRefresh: any(named: 'forceRefresh'),
              )).thenAnswer((_) async => testProducts);
          return ProductListBloc(repository: mockRepository);
        },
        seed: () => ProductListState(
          status: ProductStatus.success,
          products: testProducts.take(5).toList(),
          searchQuery: 'previous search',
        ),
        act: (bloc) => bloc.add(const ClearSearch()),
        expect: () => [
          isA<ProductListState>()
              .having((s) => s.searchQuery, 'searchQuery', '')
              .having((s) => s.status, 'status', ProductStatus.loading),
          isA<ProductListState>()
              .having((s) => s.status, 'status', ProductStatus.success)
              .having((s) => s.products.length, 'products.length', 20),
        ],
        verify: (_) {
          verify(() => mockRepository.getProducts(
                page: 1,
                limit: 20,
                categoryId: null,
                searchQuery: null,
                forceRefresh: false,
              )).called(1);
        },
      );
    });
  });
}
