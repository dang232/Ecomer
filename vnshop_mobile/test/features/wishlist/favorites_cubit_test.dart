import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/wishlist/domain/repositories/wishlist_repository.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/favorites_cubit.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/favorites_state.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_cubit.dart';

class MockProductRepository extends Mock implements ProductRepository {}

class MockWishlistRepository extends Mock implements WishlistRepository {}

void main() {
  late MockProductRepository products;
  late MockWishlistRepository wishlistRepository;
  late WishlistCubit wishlist;

  ProductModel product(String id, String name) => ProductModel(
    id: id,
    name: name,
    description: '$name description',
    price: 100000,
    imageUrl: '',
    stock: 4,
    categoryId: 'audio',
    categoryName: 'Audio',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );

  setUp(() {
    products = MockProductRepository();
    wishlistRepository = MockWishlistRepository();
    wishlist = WishlistCubit(repository: wishlistRepository);
  });

  tearDown(() => wishlist.close());

  blocTest<FavoritesCubit, FavoritesState>(
    'hydrates wishlist product ids in server order',
    setUp: () {
      when(
        () => wishlistRepository.getProductIds(),
      ).thenAnswer((_) async => ['second', 'first']);
      when(
        () => products.getProductById('second'),
      ).thenAnswer((_) async => product('second', 'Second'));
      when(
        () => products.getProductById('first'),
      ).thenAnswer((_) async => product('first', 'First'));
    },
    build: () =>
        FavoritesCubit(productRepository: products, wishlistCubit: wishlist),
    act: (cubit) async {
      await cubit.refresh();
      await Future<void>.delayed(Duration.zero);
    },
    expect: () => [
      const FavoritesState(status: FavoritesStatus.loading),
      isA<FavoritesState>()
          .having((state) => state.status, 'status', FavoritesStatus.success)
          .having(
            (state) => state.products.map((item) => item.id).toList(),
            'product order',
            ['second', 'first'],
          ),
    ],
  );

  blocTest<FavoritesCubit, FavoritesState>(
    'shows a failure when no wishlist product can be loaded',
    setUp: () {
      when(
        () => wishlistRepository.getProductIds(),
      ).thenAnswer((_) async => ['missing']);
      when(
        () => products.getProductById('missing'),
      ).thenThrow(Exception('not found'));
    },
    build: () =>
        FavoritesCubit(productRepository: products, wishlistCubit: wishlist),
    act: (cubit) async {
      await cubit.refresh();
      await Future<void>.delayed(Duration.zero);
    },
    expect: () => [
      const FavoritesState(status: FavoritesStatus.loading),
      isA<FavoritesState>()
          .having((state) => state.status, 'status', FavoritesStatus.failure)
          .having((state) => state.failedProductIds, 'failed ids', ['missing']),
    ],
  );

  blocTest<FavoritesCubit, FavoritesState>(
    'removes an optimistic wishlist item without refetching retained products',
    setUp: () {
      when(
        () => wishlistRepository.getProductIds(),
      ).thenAnswer((_) async => ['saved']);
      when(
        () => wishlistRepository.toggle('saved'),
      ).thenAnswer((_) async => false);
      when(
        () => products.getProductById('saved'),
      ).thenAnswer((_) async => product('saved', 'Saved'));
    },
    build: () =>
        FavoritesCubit(productRepository: products, wishlistCubit: wishlist),
    act: (cubit) async {
      await cubit.refresh();
      await Future<void>.delayed(Duration.zero);
      await wishlist.toggle('saved');
      await Future<void>.delayed(Duration.zero);
    },
    expect: () => [
      const FavoritesState(status: FavoritesStatus.loading),
      isA<FavoritesState>().having(
        (state) => state.products.map((item) => item.id).toList(),
        'loaded products',
        ['saved'],
      ),
      isA<FavoritesState>()
          .having((state) => state.status, 'status', FavoritesStatus.success)
          .having((state) => state.products, 'products', isEmpty),
    ],
    verify: (_) => verify(() => products.getProductById('saved')).called(1),
  );
}
