import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/core/theme/app_theme.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_item_model.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_model.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_page_result.dart';
import 'package:vnshop_mobile/features/orders/domain/repositories/order_repository.dart';
import 'package:vnshop_mobile/features/orders/presentation/bloc/order_detail_cubit.dart';
import 'package:vnshop_mobile/features/orders/presentation/bloc/order_list_bloc.dart';
import 'package:vnshop_mobile/features/orders/presentation/pages/order_detail_page.dart';
import 'package:vnshop_mobile/features/orders/presentation/pages/order_list_page.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockPageOrderRepository extends Mock implements OrderRepository {}

OrderModel _summary() => OrderModel(
  id: '2ff65816-fa6d-4bb2-beaf-47d5fffa0445',
  orderNumber: '2ff65816-fa6d-4bb2-beaf-47d5fffa0445',
  status: OrderStatus.confirmed,
  items: const [],
  subtotal: 0,
  shippingFee: 0,
  totalAmount: 1245000,
  createdAt: DateTime.utc(2026, 7, 15, 8, 30),
  summaryItemCount: 3,
);

OrderModel _detail({OrderStatus status = OrderStatus.confirmed}) => OrderModel(
  id: '2ff65816-fa6d-4bb2-beaf-47d5fffa0445',
  orderNumber: 'VN-2026-0000000000000001',
  status: status,
  items: const [
    OrderItemModel(
      id: 'product-1:BLACK-128:seller-1',
      productId: 'product-1',
      productName: 'Wireless headphones with a deliberately long product name',
      productImage: '',
      price: 600000,
      quantity: 2,
      totalPrice: 1200000,
      variantSku: 'BLACK-128',
    ),
  ],
  subtotal: 1200000,
  shippingFee: 55000,
  discount: 10000,
  totalAmount: 1245000,
  shippingAddress: '12 Nguyen Hue Street',
  shippingWard: 'Ben Nghe Ward',
  shippingDistrict: 'District 1',
  shippingCity: 'Ho Chi Minh City',
  createdAt: DateTime.utc(2026, 7, 15, 8, 30),
  updatedAt: DateTime.utc(2026, 7, 16, 9, 45),
  trackingNumber: 'TRACK-001-VERY-LONG-NUMBER',
  carrier: 'GHN Express',
  shippingMethod: 'standard',
  paymentMethod: 'VIETQR',
  paymentStatus: 'COMPLETED',
  isPaid: true,
);

Widget _app(Widget child, {double textScale = 2}) {
  return MaterialApp(
    locale: const Locale('en'),
    theme: AppTheme.lightTheme,
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
    home: child,
  );
}

void main() {
  late MockPageOrderRepository repository;

  setUp(() {
    repository = MockPageOrderRepository();
  });

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  testWidgets('order list is readable at 200% text without layout exceptions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    when(
      () => repository.getOrders(
        page: 1,
        limit: 20,
        status: null,
        forceRefresh: false,
      ),
    ).thenAnswer((_) async => OrderPageResult.singlePage([_summary()]));

    await tester.pumpWidget(
      _app(
        BlocProvider(
          create: (_) => OrderListBloc(orderRepository: repository),
          child: const OrderListPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('My orders'), findsOneWidget);
    expect(find.text('1 order'), findsOneWidget);
    expect(find.text('Confirmed'), findsWidgets);
    expect(find.text('3 items'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('order list exposes a localized retry state', (tester) async {
    when(
      () => repository.getOrders(
        page: 1,
        limit: 20,
        status: null,
        forceRefresh: false,
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/orders'),
        type: DioExceptionType.connectionError,
      ),
    );

    await tester.pumpWidget(
      _app(
        BlocProvider(
          create: (_) => OrderListBloc(orderRepository: repository),
          child: const OrderListPage(),
        ),
        textScale: 1,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Orders couldn't be loaded"), findsOneWidget);
    expect(find.text('Check your connection and try again.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('order detail renders real data at 200% text and can cancel', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    when(
      () => repository.getOrderById(any()),
    ).thenAnswer((_) async => _detail());
    when(
      () => repository.cancelOrder(any()),
    ).thenAnswer((_) async => _detail(status: OrderStatus.cancelled));

    await tester.pumpWidget(
      _app(
        BlocProvider(
          create: (_) => OrderDetailCubit(
            orderId: '2ff65816-fa6d-4bb2-beaf-47d5fffa0445',
            repository: repository,
          ),
          child: const OrderDetailPage(
            orderId: '2ff65816-fa6d-4bb2-beaf-47d5fffa0445',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Order details'), findsOneWidget);
    expect(find.text('VN-2026-0000000000000001'), findsWidgets);
    expect(find.textContaining('12 Nguyen Hue Street'), findsOneWidget);
    expect(find.textContaining('Wireless headphones'), findsOneWidget);
    expect(find.text('Paid'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final cancelButton = find.byKey(const Key('order-detail-cancel'));
    await tester.ensureVisible(cancelButton);
    await tester.tap(cancelButton);
    await tester.pumpAndSettle();
    expect(find.text('Cancel this order?'), findsOneWidget);

    await tester.tap(find.text('Yes, cancel order'));
    await tester.pumpAndSettle();
    verify(
      () => repository.cancelOrder('2ff65816-fa6d-4bb2-beaf-47d5fffa0445'),
    ).called(1);
    expect(find.text('Cancelled'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
