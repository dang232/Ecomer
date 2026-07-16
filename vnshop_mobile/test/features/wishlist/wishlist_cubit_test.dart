import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/wishlist/domain/repositories/wishlist_repository.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_state.dart';

class MockWishlistRepository extends Mock implements WishlistRepository {}

void main() {
  late MockWishlistRepository repository;

  setUp(() {
    repository = MockWishlistRepository();
  });

  blocTest<WishlistCubit, WishlistState>(
    'loads the shared wishlist once authenticated',
    build: () {
      when(
        () => repository.getProductIds(),
      ).thenAnswer((_) async => ['product-1', 'product-2']);
      return WishlistCubit(repository: repository);
    },
    act: (cubit) => cubit.load(),
    expect: () => [
      const WishlistState(status: WishlistStatus.loading),
      const WishlistState(
        status: WishlistStatus.ready,
        productIds: ['product-1', 'product-2'],
      ),
    ],
  );

  blocTest<WishlistCubit, WishlistState>(
    'optimistically toggles and reconciles with the server',
    build: () {
      when(() => repository.toggle('product-2')).thenAnswer((_) async => true);
      return WishlistCubit(repository: repository);
    },
    seed: () => const WishlistState(
      status: WishlistStatus.ready,
      productIds: ['product-1'],
    ),
    act: (cubit) => cubit.toggle('product-2'),
    expect: () => [
      isA<WishlistState>()
          .having(
            (state) => state.contains('product-2'),
            'optimistic item',
            true,
          )
          .having(
            (state) => state.isPending('product-2'),
            'pending item',
            true,
          ),
      isA<WishlistState>()
          .having((state) => state.contains('product-2'), 'server item', true)
          .having(
            (state) => state.isPending('product-2'),
            'pending item',
            false,
          )
          .having((state) => state.action, 'action', WishlistAction.added),
    ],
  );

  blocTest<WishlistCubit, WishlistState>(
    'reverts the optimistic toggle when the request fails',
    build: () {
      when(
        () => repository.toggle('product-1'),
      ).thenThrow(Exception('network unavailable'));
      return WishlistCubit(repository: repository);
    },
    seed: () => const WishlistState(
      status: WishlistStatus.ready,
      productIds: ['product-1'],
    ),
    act: (cubit) => cubit.toggle('product-1'),
    expect: () => [
      isA<WishlistState>()
          .having(
            (state) => state.contains('product-1'),
            'optimistic item',
            false,
          )
          .having(
            (state) => state.isPending('product-1'),
            'pending item',
            true,
          ),
      isA<WishlistState>()
          .having((state) => state.contains('product-1'), 'reverted item', true)
          .having(
            (state) => state.isPending('product-1'),
            'pending item',
            false,
          )
          .having((state) => state.action, 'action', WishlistAction.failed),
    ],
  );
}
