import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/app/router/checkout_route_args.dart';
import 'package:vnshop_mobile/core/theme/app_theme.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_item_model.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_bloc.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_event.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';
import 'package:vnshop_mobile/features/cart/presentation/pages/cart_page.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockCartBloc extends MockBloc<CartEvent, CartState> implements CartBloc {}

void main() {
  late MockCartBloc cartBloc;
  late GoRouter router;

  final cart = CartModel(
    id: 'cart-1',
    userId: 'buyer-1',
    items: const [
      CartItemModel(
        cartItemId: 'item-1',
        productId: 'product-1',
        name: 'Studio headphones with an intentionally long product title',
        price: 1250000,
        quantity: 1,
        optionName: 'Black / Limited edition',
      ),
      CartItemModel(
        cartItemId: 'item-2',
        productId: 'product-2',
        name: 'Mechanical keyboard',
        price: 850000,
        quantity: 1,
      ),
    ],
    updatedAt: DateTime(2026),
  );

  setUp(() {
    cartBloc = MockCartBloc();
    when(
      () => cartBloc.state,
    ).thenReturn(CartState(status: CartStatus.loaded, cart: cart));
    router = GoRouter(
      initialLocation: '/cart',
      routes: [
        GoRoute(
          path: '/cart',
          builder: (context, state) => BlocProvider<CartBloc>.value(
            value: cartBloc,
            child: const CartPage(),
          ),
        ),
        GoRoute(
          path: '/checkout',
          builder: (context, state) {
            final args = state.extra! as CheckoutRouteArgs;
            return Scaffold(body: Text(args.selectedCartItemIds.join(',')));
          },
        ),
      ],
    );
  });

  tearDown(() async {
    router.dispose();
    await cartBloc.close();
  });

  Future<void> pumpCart(WidgetTester tester, {double textScale = 1}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp.router(
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
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders the loaded cart at 200 percent text', (tester) async {
    await pumpCart(tester, textScale: 2);
    expect(cartBloc.state.status, CartStatus.loaded);
    expect(cartBloc.state.cart, cart);
    final renderedText = tester
        .widgetList<Text>(find.byType(Text))
        .map((widget) => widget.data)
        .whereType<String>()
        .join(' | ');

    expect(find.text('Cart'), findsOneWidget);
    expect(find.text('2 of 2 selected'), findsOneWidget, reason: renderedText);
    expect(
      find.text('Studio headphones with an intentionally long product title'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('passes only selected rows to checkout', (tester) async {
    await pumpCart(tester);

    await tester.tap(find.byKey(const Key('cart-selection-item-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Checkout (1)'));
    await tester.pumpAndSettle();

    expect(find.text('item-2'), findsOneWidget);
  });
}
