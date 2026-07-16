import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/app/router/checkout_route_args.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_bloc.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_event.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:vnshop_mobile/features/checkout/presentation/pages/checkout_page.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockCartBloc extends MockBloc<CartEvent, CartState> implements CartBloc {}

class MockCheckoutBloc extends MockBloc<CheckoutEvent, CheckoutState>
    implements CheckoutBloc {}

class FakeCheckoutEvent extends Fake implements CheckoutEvent {}

void main() {
  late MockCartBloc cartBloc;
  late MockCheckoutBloc checkoutBloc;

  final cart = CartModel(
    id: 'cart-1',
    userId: 'buyer-1',
    items: const [
      CartItemModel(
        cartItemId: 'item-1',
        productId: 'product-1',
        name: 'Headphones',
        price: 500000,
        quantity: 1,
      ),
      CartItemModel(
        cartItemId: 'item-2',
        productId: 'product-2',
        name: 'Keyboard',
        price: 300000,
        quantity: 2,
      ),
    ],
    appliedCouponCode: 'SAVE10',
    discountAmount: 80000,
    updatedAt: DateTime(2026),
  );

  setUpAll(() {
    registerFallbackValue(FakeCheckoutEvent());
  });

  setUp(() {
    cartBloc = MockCartBloc();
    checkoutBloc = MockCheckoutBloc();
    when(
      () => cartBloc.state,
    ).thenReturn(CartState(status: CartStatus.loaded, cart: cart));
    when(
      () => checkoutBloc.state,
    ).thenReturn(const CheckoutState(status: CheckoutStatus.loading));
  });

  tearDown(() async {
    await cartBloc.close();
    await checkoutBloc.close();
  });

  Future<void> pumpPage(
    WidgetTester tester,
    CheckoutRouteArgs routeArgs,
  ) async {
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<CartBloc>.value(value: cartBloc),
          BlocProvider<CheckoutBloc>.value(value: checkoutBloc),
        ],
        child: MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: CheckoutPage(routeArgs: routeArgs),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('starts checkout with only the selected cart rows', (
    tester,
  ) async {
    await pumpPage(tester, const CheckoutRouteArgs({'item-2'}));

    final captured = verify(
      () => checkoutBloc.add(captureAny()),
    ).captured.whereType<CheckoutStarted>().single;
    expect(captured.lineItems, hasLength(1));
    expect(captured.lineItems.single.productId, 'product-2');
    expect(captured.lineItems.single.quantity, 2);
    expect(captured.subtotal, 600000);
    expect(captured.discountAmount, 0);
    expect(captured.couponCode, 'SAVE10');
  });

  testWidgets('shows a recoverable empty state for stale selected ids', (
    tester,
  ) async {
    await pumpPage(tester, const CheckoutRouteArgs({'missing-item'}));

    expect(find.text('No items selected'), findsOneWidget);
    verifyNever(() => checkoutBloc.add(any()));
  });
}
