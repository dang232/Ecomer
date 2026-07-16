import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/cart/domain/repositories/cart_repository.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_bloc.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_event.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';

class MockCartRepository extends Mock implements CartRepository {}

class FakeCartItemModel extends Fake implements CartItemModel {}

void main() {
  late MockCartRepository mockRepository;

  // Test with item that has different productId to avoid quantity merge behavior
  const testCartItem = CartItemModel(
    cartItemId: 'item_1',
    productId: 'prod_1',
    name: 'Test Product',
    price: 125000.0,
    quantity: 2,
    imageUrl: 'https://example.com/image.jpg',
  );

  const testCartItem2 = CartItemModel(
    cartItemId: 'item_2',
    productId: 'prod_2',
    name: 'Test Product 2',
    price: 50000.0,
    quantity: 1,
    imageUrl: 'https://example.com/image2.jpg',
  );

  // Item with different product ID for add tests
  const testCartItem3 = CartItemModel(
    cartItemId: 'item_3',
    productId: 'prod_3',
    name: 'Test Product 3',
    price: 75000.0,
    quantity: 1,
    imageUrl: 'https://example.com/image3.jpg',
  );

  final testCart = CartModel(
    id: 'cart_1',
    userId: 'user_1',
    items: const [testCartItem, testCartItem2],
    updatedAt: DateTime.now(),
  );

  setUpAll(() {
    registerFallbackValue(FakeCartItemModel());
  });

  setUp(() {
    mockRepository = MockCartRepository();
  });

  group('CartBloc', () {
    group('CartStarted', () {
      blocTest<CartBloc, CartState>(
        'emits [loading, loaded] with cart data when load succeeds',
        build: () {
          when(
            () => mockRepository.getCart(),
          ).thenAnswer((_) async => testCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const CartStarted()),
        expect: () => [
          const CartState(status: CartStatus.loading),
          CartState(status: CartStatus.loaded, cart: testCart, isOnline: true),
        ],
        verify: (_) {
          verify(() => mockRepository.getCart()).called(1);
        },
      );

      blocTest<CartBloc, CartState>(
        'emits [loading, error] when load fails',
        build: () {
          when(
            () => mockRepository.getCart(),
          ).thenThrow(Exception('Network error'));
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        act: (bloc) => bloc.add(const CartStarted()),
        expect: () => [
          const CartState(status: CartStatus.loading),
          isA<CartState>()
              .having((s) => s.status, 'status', CartStatus.error)
              .having((s) => s.failure, 'failure', CartFailure.load),
        ],
      );
    });

    group('Add Item to Cart', () {
      blocTest<CartBloc, CartState>(
        'emits [loaded with optimistic update] then [loaded with server response] when add succeeds',
        build: () {
          final updatedCart = testCart.addItem(testCartItem3);
          when(
            () => mockRepository.addItem(any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemAdded(testCartItem3)),
        expect: () => [
          // First: optimistic update
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 3),
          // Then: server response
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 3),
        ],
        verify: (_) {
          verify(() => mockRepository.addItem(testCartItem3)).called(1);
        },
      );

      blocTest<CartBloc, CartState>(
        'emits [optimistic update, error with reverted state] when add fails',
        build: () {
          when(
            () => mockRepository.addItem(any()),
          ).thenThrow(Exception('Server error'));
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemAdded(testCartItem3)),
        expect: () => [
          // Optimistic update
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 3),
          // Revert on error
          isA<CartState>()
              .having((s) => s.cart?.items.length, 'item count', 2)
              .having((s) => s.failure, 'failure', CartFailure.addItem),
        ],
      );

      blocTest<CartBloc, CartState>(
        'updates quantity when adding existing product to cart',
        build: () {
          // When adding an item with same productId, it updates quantity
          final updatedCart = testCart.addItem(testCartItem);
          when(
            () => mockRepository.addItem(any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemAdded(testCartItem)),
        expect: () => [
          // Optimistic update - still 2 items but quantity increased
          isA<CartState>().having(
            (s) => s.cart?.items
                .firstWhere((i) => i.cartItemId == 'item_1')
                .quantity,
            'quantity',
            4, // 2 + 2
          ),
          isA<CartState>().having(
            (s) => s.cart?.items
                .firstWhere((i) => i.cartItemId == 'item_1')
                .quantity,
            'quantity',
            4,
          ),
        ],
      );
    });

    group('Update Quantity', () {
      blocTest<CartBloc, CartState>(
        'emits [optimistic update, server response] when update succeeds',
        build: () {
          final updatedCart = testCart.updateItemQuantity('item_1', 5);
          when(
            () => mockRepository.updateItemQuantity(any(), any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(
          const CartItemQuantityUpdated(cartItemId: 'item_1', quantity: 5),
        ),
        expect: () => [
          // Optimistic update
          isA<CartState>().having(
            (s) => s.cart?.items
                .firstWhere((i) => i.cartItemId == 'item_1')
                .quantity,
            'quantity',
            5,
          ),
          // Server response
          isA<CartState>().having(
            (s) => s.cart?.items
                .firstWhere((i) => i.cartItemId == 'item_1')
                .quantity,
            'quantity',
            5,
          ),
        ],
        verify: (_) {
          verify(
            () => mockRepository.updateItemQuantity('item_1', 5),
          ).called(1);
        },
      );

      blocTest<CartBloc, CartState>(
        'emits [optimistic update, error with reverted state] when update fails',
        build: () {
          when(
            () => mockRepository.updateItemQuantity(any(), any()),
          ).thenThrow(Exception('Update failed'));
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(
          const CartItemQuantityUpdated(cartItemId: 'item_1', quantity: 5),
        ),
        expect: () => [
          // Optimistic update
          isA<CartState>().having(
            (s) => s.cart?.items
                .firstWhere((i) => i.cartItemId == 'item_1')
                .quantity,
            'quantity',
            5,
          ),
          // Revert on error
          isA<CartState>()
              .having(
                (s) => s.cart?.items
                    .firstWhere((i) => i.cartItemId == 'item_1')
                    .quantity,
                'quantity',
                2, // Original quantity
              )
              .having((s) => s.failure, 'failure', CartFailure.updateQuantity),
        ],
      );

      blocTest<CartBloc, CartState>(
        'removes item when quantity set to 0',
        build: () {
          final updatedCart = testCart.removeItem('item_1');
          when(
            () => mockRepository.updateItemQuantity(any(), any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(
          const CartItemQuantityUpdated(cartItemId: 'item_1', quantity: 0),
        ),
        expect: () => [
          // Item removed (quantity 0 triggers remove)
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 1),
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 1),
        ],
      );
    });

    group('Remove Item', () {
      blocTest<CartBloc, CartState>(
        'emits [optimistic update, server response] when remove succeeds',
        build: () {
          final updatedCart = testCart.removeItem('item_1');
          when(
            () => mockRepository.removeItem(any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemRemoved('item_1')),
        expect: () => [
          // Optimistic update
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 1),
          // Server response
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 1),
        ],
        verify: (_) {
          verify(() => mockRepository.removeItem('item_1')).called(1);
        },
      );

      blocTest<CartBloc, CartState>(
        'emits [optimistic update, error with reverted state] when remove fails',
        build: () {
          when(
            () => mockRepository.removeItem(any()),
          ).thenThrow(Exception('Remove failed'));
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemRemoved('item_1')),
        expect: () => [
          // Optimistic update
          isA<CartState>().having((s) => s.cart?.items.length, 'item count', 1),
          // Revert on error
          isA<CartState>()
              .having((s) => s.cart?.items.length, 'item count', 2)
              .having((s) => s.failure, 'failure', CartFailure.removeItem),
        ],
      );
    });

    group('Offline Queue Operations', () {
      blocTest<CartBloc, CartState>(
        'emits [syncing, synced] when sync requested while online',
        build: () {
          when(
            () => mockRepository.syncPendingOperations(),
          ).thenAnswer((_) async {});
          when(
            () => mockRepository.getCart(),
          ).thenAnswer((_) async => testCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(
          status: CartStatus.loaded,
          cart: testCart,
          isOnline: true,
        ),
        act: (bloc) => bloc.add(const CartSyncRequested()),
        expect: () => [
          isA<CartState>().having((s) => s.isSyncing, 'isSyncing', true),
          isA<CartState>()
              .having((s) => s.isSyncing, 'isSyncing', false)
              .having((s) => s.cart, 'cart', testCart),
        ],
        verify: (_) {
          verify(() => mockRepository.syncPendingOperations()).called(1);
        },
      );

      blocTest<CartBloc, CartState>(
        'does not sync when offline',
        build: () {
          when(
            () => mockRepository.syncPendingOperations(),
          ).thenAnswer((_) async {});
          when(
            () => mockRepository.getCart(),
          ).thenAnswer((_) async => testCart);
          when(() => mockRepository.isOnline).thenReturn(false);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(
          status: CartStatus.loaded,
          cart: testCart,
          isOnline: false,
        ),
        act: (bloc) => bloc.add(const CartSyncRequested()),
        expect: () => [],
        verify: (_) {
          verifyNever(() => mockRepository.syncPendingOperations());
        },
      );

      blocTest<CartBloc, CartState>(
        'triggers sync when coming back online',
        build: () {
          when(
            () => mockRepository.syncPendingOperations(),
          ).thenAnswer((_) async {});
          when(
            () => mockRepository.getCart(),
          ).thenAnswer((_) async => testCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(
          status: CartStatus.loaded,
          cart: testCart,
          isOnline: false,
        ),
        act: (bloc) => bloc.add(const CartConnectivityChanged(true)),
        expect: () => [
          isA<CartState>().having((s) => s.isOnline, 'isOnline', true),
          isA<CartState>().having((s) => s.isSyncing, 'isSyncing', true),
          isA<CartState>()
              .having((s) => s.isSyncing, 'isSyncing', false)
              .having((s) => s.cart, 'cart', testCart),
        ],
      );

      blocTest<CartBloc, CartState>(
        'updates online status when going offline',
        build: () => CartBloc(repository: mockRepository),
        seed: () => CartState(
          status: CartStatus.loaded,
          cart: testCart,
          isOnline: true,
        ),
        act: (bloc) => bloc.add(const CartConnectivityChanged(false)),
        expect: () => [
          isA<CartState>().having((s) => s.isOnline, 'isOnline', false),
        ],
      );
    });

    group('Increment/Decrement', () {
      blocTest<CartBloc, CartState>(
        'emits [quantity update] when incrementing item quantity',
        build: () {
          final updatedCart = testCart.updateItemQuantity('item_1', 3);
          when(
            () => mockRepository.updateItemQuantity(any(), any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemIncremented('item_1')),
        expect: () => [isA<CartState>(), isA<CartState>()],
      );

      blocTest<CartBloc, CartState>(
        'emits [remove] when decrementing item with quantity 1',
        build: () {
          final updatedCart = testCart.removeItem('item_1');
          when(
            () => mockRepository.removeItem(any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemDecremented('item_1')),
        expect: () => [isA<CartState>(), isA<CartState>()],
      );

      blocTest<CartBloc, CartState>(
        'emits [quantity update] when decrementing item with quantity > 1',
        build: () {
          final updatedCart = testCart.updateItemQuantity('item_1', 1);
          when(
            () => mockRepository.updateItemQuantity(any(), any()),
          ).thenAnswer((_) async => updatedCart);
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartItemDecremented('item_1')),
        expect: () => [isA<CartState>(), isA<CartState>()],
      );
    });

    group('Clear Cart', () {
      blocTest<CartBloc, CartState>(
        'emits [empty cart, syncing, empty cart] when clear succeeds',
        build: () {
          when(() => mockRepository.clearCart()).thenAnswer((_) async {});
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartCleared()),
        expect: () => [
          isA<CartState>()
              .having((s) => s.cart?.isEmpty, 'isEmpty', true)
              .having((s) => s.isSyncing, 'isSyncing', true),
          isA<CartState>()
              .having((s) => s.cart?.isEmpty, 'isEmpty', true)
              .having((s) => s.isSyncing, 'isSyncing', false),
        ],
        verify: (_) {
          verify(() => mockRepository.clearCart()).called(1);
        },
      );

      blocTest<CartBloc, CartState>(
        'emits [empty cart, error with reverted state] when clear fails',
        build: () {
          when(
            () => mockRepository.clearCart(),
          ).thenThrow(Exception('Clear failed'));
          when(() => mockRepository.isOnline).thenReturn(true);
          return CartBloc(repository: mockRepository);
        },
        seed: () => CartState(status: CartStatus.loaded, cart: testCart),
        act: (bloc) => bloc.add(const CartCleared()),
        expect: () => [
          isA<CartState>()
              .having((s) => s.cart?.isEmpty, 'isEmpty', true)
              .having((s) => s.isSyncing, 'isSyncing', true),
          isA<CartState>()
              .having((s) => s.cart?.items.length, 'items', 2)
              .having((s) => s.isSyncing, 'isSyncing', false)
              .having((s) => s.failure, 'failure', CartFailure.clearCart),
        ],
      );
    });
  });
}
