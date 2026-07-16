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
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/wishlist/domain/repositories/wishlist_repository.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/pages/favorites_page.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockProductRepository extends Mock implements ProductRepository {}

class MockWishlistRepository extends Mock implements WishlistRepository {}

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockProductRepository products;
  late MockWishlistRepository wishlistRepository;
  late MockAuthBloc authBloc;
  late WishlistCubit wishlist;

  final savedProduct = ProductModel(
    id: 'saved-product',
    name: 'Saved studio headphones',
    description: 'A real saved product',
    price: 1250000,
    imageUrl: '',
    stock: 8,
    categoryId: 'audio',
    categoryName: 'Audio',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
  );

  setUp(() {
    products = MockProductRepository();
    wishlistRepository = MockWishlistRepository();
    authBloc = MockAuthBloc();
    wishlist = WishlistCubit(repository: wishlistRepository);
    when(() => authBloc.state).thenReturn(const AuthState.unauthenticated());
  });

  tearDown(() async {
    await wishlist.close();
    await authBloc.close();
  });

  Future<void> pumpPage(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      Provider<ProductRepository>.value(
        value: products,
        child: MultiBlocProvider(
          providers: [
            BlocProvider<AuthBloc>.value(value: authBloc),
            BlocProvider<WishlistCubit>.value(value: wishlist),
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
              ).copyWith(textScaler: const TextScaler.linear(2)),
              child: child!,
            ),
            home: const FavoritesPage(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders hydrated favorites without large-text overflow', (
    tester,
  ) async {
    when(
      () => wishlistRepository.getProductIds(),
    ).thenAnswer((_) async => ['saved-product']);
    when(
      () => products.getProductById('saved-product'),
    ).thenAnswer((_) async => savedProduct);
    await wishlist.load();

    await pumpPage(tester);

    expect(find.text('Saved studio headphones'), findsOneWidget);
    expect(find.text('1 saved product'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows an empty state when no products are saved', (
    tester,
  ) async {
    when(
      () => wishlistRepository.getProductIds(),
    ).thenAnswer((_) async => const []);
    await wishlist.load();

    await pumpPage(tester);

    expect(find.text('No favorites yet'), findsOneWidget);
    expect(find.text('Browse products'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('retries a failed wishlist request', (tester) async {
    var attempts = 0;
    when(() => wishlistRepository.getProductIds()).thenAnswer((_) async {
      attempts++;
      if (attempts == 1) throw Exception('offline');
      return const [];
    });
    await wishlist.load();

    await pumpPage(tester);
    expect(find.text("Favorites couldn't be loaded"), findsOneWidget);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(attempts, 2);
    expect(find.text('No favorites yet'), findsOneWidget);
  });
}
