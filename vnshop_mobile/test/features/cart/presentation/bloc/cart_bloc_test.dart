import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/cart/domain/repositories/cart_repository.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_bloc.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_event.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';

class MockCartRepository extends Mock implements CartRepository {}

void main() {
  late MockCartRepository repository;

  const firstItem = CartItemModel(
    cartItemId: 'item-1',
    productId: 'product-1',
    name: 'Headphones',
    price: 500000,
    quantity: 1,
  );
  const secondItem = CartItemModel(
    cartItemId: 'item-2',
    productId: 'product-2',
    name: 'Keyboard',
    price: 300000,
    quantity: 1,
  );
  final cart = CartModel(
    id: 'cart-1',
    userId: 'buyer-1',
    items: const [firstItem, secondItem],
    appliedCouponCode: 'SAVE10',
    discountAmount: 50000,
    updatedAt: DateTime(2026),
  );
  final cartAfterRemoval = cart.copyWith(
    items: const [secondItem],
    updatedAt: DateTime(2026, 1, 2),
  );
  final cartAfterCouponRemoval = cartAfterRemoval.copyWith(
    clearAppliedCouponCode: true,
    discountAmount: 0,
    updatedAt: DateTime(2026, 1, 3),
  );

  setUp(() {
    repository = MockCartRepository();
    when(() => repository.isOnline).thenReturn(true);
  });

  blocTest<CartBloc, CartState>(
    'loads the current cart',
    build: () {
      when(() => repository.getCart()).thenAnswer((_) async => cart);
      return CartBloc(repository: repository);
    },
    act: (bloc) => bloc.add(const CartStarted()),
    expect: () => [
      const CartState(status: CartStatus.loading),
      CartState(status: CartStatus.loaded, cart: cart, isOnline: true),
    ],
  );

  blocTest<CartBloc, CartState>(
    'partial checkout removes purchased rows and preserves the others',
    build: () {
      when(
        () => repository.removeItem('item-1'),
      ).thenAnswer((_) async => cartAfterRemoval);
      when(
        () => repository.removeCoupon(),
      ).thenAnswer((_) async => cartAfterCouponRemoval);
      return CartBloc(repository: repository);
    },
    seed: () => CartState(status: CartStatus.loaded, cart: cart),
    act: (bloc) => bloc.add(const CartCheckoutCompleted({'item-1'})),
    expect: () => [
      isA<CartState>()
          .having((state) => state.isSyncing, 'isSyncing', isTrue)
          .having(
            (state) => state.cart?.items.map((item) => item.cartItemId),
            'remaining ids',
            ['item-2'],
          )
          .having((state) => state.cart?.appliedCouponCode, 'coupon', isNull),
      isA<CartState>()
          .having((state) => state.isSyncing, 'isSyncing', isFalse)
          .having(
            (state) => state.cart?.items.map((item) => item.cartItemId),
            'remaining ids',
            ['item-2'],
          ),
    ],
    verify: (_) {
      verify(() => repository.removeItem('item-1')).called(1);
      verify(() => repository.removeCoupon()).called(1);
      verifyNever(repository.clearCart);
    },
  );

  blocTest<CartBloc, CartState>(
    'full checkout clears the cart in one operation',
    build: () {
      when(repository.clearCart).thenAnswer((_) async {});
      return CartBloc(repository: repository);
    },
    seed: () => CartState(status: CartStatus.loaded, cart: cart),
    act: (bloc) => bloc.add(const CartCheckoutCompleted({'item-1', 'item-2'})),
    expect: () => [
      isA<CartState>()
          .having((state) => state.isSyncing, 'isSyncing', isTrue)
          .having((state) => state.cart?.isEmpty, 'is empty', isTrue),
      isA<CartState>()
          .having((state) => state.isSyncing, 'isSyncing', isFalse)
          .having((state) => state.cart?.isEmpty, 'is empty', isTrue),
    ],
    verify: (_) {
      verify(repository.clearCart).called(1);
      verifyNever(() => repository.removeItem(any()));
    },
  );
}
