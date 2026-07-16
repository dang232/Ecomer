import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_state.dart';
import 'package:vnshop_mobile/features/products/data/models/category_model.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/domain/models/product_catalog_query.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/products/presentation/pages/product_list_page.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_state.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockProductRepository extends Mock implements ProductRepository {}

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

class MockWishlistCubit extends MockCubit<WishlistState>
    implements WishlistCubit {}

void main() {
  late MockProductRepository repository;
  late MockAuthBloc authBloc;
  late MockWishlistCubit wishlistCubit;

  final product = ProductModel(
    id: 'product-42',
    name: 'Real studio headphones',
    description: 'Loaded from search',
    price: 1250000,
    imageUrl: '',
    stock: 8,
    categoryId: 'audio',
    categoryName: 'Audio',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );

  setUpAll(() {
    registerFallbackValue(const ProductCatalogFilters());
    registerFallbackValue(ProductSort.newest);
  });

  setUp(() {
    repository = MockProductRepository();
    authBloc = MockAuthBloc();
    wishlistCubit = MockWishlistCubit();
    when(() => authBloc.state).thenReturn(const AuthState.unauthenticated());
    when(
      () => wishlistCubit.state,
    ).thenReturn(const WishlistState(status: WishlistStatus.ready));
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
    ).thenAnswer((_) async => [product]);
    when(() => repository.getCategories()).thenAnswer(
      (_) async => const [CategoryModel(id: 'audio', name: 'Audio')],
    );
  });

  Future<void> pumpPage(WidgetTester tester, {double textScale = 1}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      Provider<ProductRepository>.value(
        value: repository,
        child: MultiBlocProvider(
          providers: [
            BlocProvider<AuthBloc>.value(value: authBloc),
            BlocProvider<WishlistCubit>.value(value: wishlistCubit),
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
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(textScale)),
              child: child!,
            ),
            home: const ProductListPage(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders real catalog products at 200 percent text', (
    tester,
  ) async {
    await pumpPage(tester, textScale: 2);

    expect(find.text('Products'), findsOneWidget);
    expect(find.text('Real studio headphones'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('applies supported filters and server-backed sorting', (
    tester,
  ) async {
    await pumpPage(tester);

    await tester.tap(find.byTooltip('Filters'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('min-price-field')), '100000');
    await tester.enterText(find.byKey(const Key('max-price-field')), '500000');
    await tester.tap(find.text('Verified products only'));
    await tester.tap(find.text('Apply filters'));
    await tester.pumpAndSettle();

    verify(
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
    ).called(1);

    await tester.tap(find.byTooltip('Sort products'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Price: High to low').last);
    await tester.pumpAndSettle();

    verify(
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
        sort: ProductSort.priceHighToLow,
        forceRefresh: false,
      ),
    ).called(1);
  });
}
