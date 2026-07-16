import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/app/router/checkout_route_args.dart';
import 'package:vnshop_mobile/core/theme/app_theme.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_bloc.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_event.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';
import 'package:vnshop_mobile/features/checkout/data/models/address_model.dart';
import 'package:vnshop_mobile/features/checkout/data/models/checkout_session.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';
import 'package:vnshop_mobile/features/checkout/data/models/shipping_quote.dart';
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

  const item = CartItemModel(
    cartItemId: 'item-1',
    productId: 'product-1',
    name: 'Studio headphones with a long checkout product name',
    price: 500000,
    quantity: 1,
  );
  final cart = CartModel(
    id: 'cart-1',
    userId: 'buyer-1',
    items: const [item],
    updatedAt: DateTime(2026),
  );
  const address = VietnamAddress(
    id: 'address-1',
    recipientName: 'Nguyen Van Customer With A Long Name',
    phoneNumber: '0900000000',
    streetAddress: '123 A very long street address',
    ward: 'Ward 1',
    district: 'District 1',
    city: 'Ho Chi Minh City',
    isDefault: true,
  );
  const shipping = ShippingQuote(
    id: 'standard',
    name: 'Standard delivery',
    description: 'Tracked delivery to your address',
    price: 30000,
    estimatedDays: 2,
    provider: ShippingProvider.giaoHangNhanh,
  );
  final session = CheckoutSession(
    sessionId: 'session-1',
    idempotencyKey: 'key-1',
    userId: 'buyer-1',
    lineItems: const [LineItem(productId: 'product-1', quantity: 1)],
    selectedAddress: address,
    selectedShipping: shipping,
    selectedPaymentMethod: 'cod',
    subtotal: 500000,
    shippingFee: 30000,
    discountAmount: 0,
    totalAmount: 530000,
    createdAt: DateTime(2026),
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
  });

  tearDown(() async {
    await cartBloc.close();
    await checkoutBloc.close();
  });

  Future<void> pumpPage(
    WidgetTester tester,
    CheckoutState state, {
    double textScale = 1,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    when(() => checkoutBloc.state).thenReturn(state);

    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<CartBloc>.value(value: cartBloc),
          BlocProvider<CheckoutBloc>.value(value: checkoutBloc),
        ],
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: const CheckoutPage(routeArgs: CheckoutRouteArgs({'item-1'})),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('shows the complete enabled checkout flow at 200 percent text', (
    tester,
  ) async {
    await pumpPage(
      tester,
      CheckoutState(
        status: CheckoutStatus.ready,
        session: session,
        addresses: const [address],
        selectedAddress: address,
        shippingQuotes: const [shipping],
        selectedShipping: shipping,
        availablePaymentMethods: const [
          PaymentMethod.cod,
          PaymentMethod.vietqr,
        ],
        selectedPaymentMethod: PaymentMethod.cod,
      ),
      textScale: 2,
    );

    expect(find.text('Delivery address'), findsOneWidget);
    expect(find.text('Delivery method'), findsOneWidget);
    expect(find.text('Payment method'), findsOneWidget);
    expect(find.text('Cash on delivery'), findsOneWidget);
    expect(find.text('VietQR'), findsOneWidget);
    expect(find.text('VNPay'), findsNothing);
    expect(find.text('MoMo'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows retry when payment methods cannot be loaded', (
    tester,
  ) async {
    await pumpPage(
      tester,
      CheckoutState(
        status: CheckoutStatus.addressesLoaded,
        session: session,
        addresses: const [address],
        selectedAddress: address,
        shippingQuotes: const [shipping],
        selectedShipping: shipping,
        failure: CheckoutFailure.loadPaymentMethods,
      ),
    );

    expect(find.text("Payment methods couldn't be loaded"), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('keeps an online payment recovery action visible', (
    tester,
  ) async {
    final transaction = PaymentTransaction(
      id: 'payment-1',
      orderId: 'order-1',
      idempotencyKey: 'payment-key',
      method: PaymentMethod.vietqr,
      status: PaymentStatus.pending,
      amount: 530000,
      createdAt: DateTime(2026),
    );

    await pumpPage(
      tester,
      CheckoutState(
        status: CheckoutStatus.awaitingPayment,
        session: session,
        addresses: const [address],
        selectedAddress: address,
        shippingQuotes: const [shipping],
        selectedShipping: shipping,
        availablePaymentMethods: const [PaymentMethod.vietqr],
        selectedPaymentMethod: PaymentMethod.vietqr,
        currentTransaction: transaction,
        orderId: 'order-1',
      ),
      textScale: 2,
    );

    expect(find.text('Complete payment'), findsOneWidget);
    expect(find.text('Place order'), findsNothing);

    final checkPayment = find.text('Check payment status');
    await tester.ensureVisible(checkPayment);
    await tester.pumpAndSettle();
    await tester.tap(checkPayment);
    await tester.pump();

    verify(
      () => checkoutBloc.add(const CheckoutPaymentStatusChecked('payment-1')),
    ).called(1);
    expect(tester.takeException(), isNull);
  });
}
