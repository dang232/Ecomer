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
import 'package:vnshop_mobile/features/home/presentation/pages/home_page.dart';
import 'package:vnshop_mobile/features/products/data/models/category_model.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
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

  setUp(() {
    repository = MockProductRepository();
    authBloc = MockAuthBloc();
    wishlistCubit = MockWishlistCubit();
    when(() => authBloc.state).thenReturn(const AuthState.unauthenticated());
    when(
      () => wishlistCubit.state,
    ).thenReturn(const WishlistState(status: WishlistStatus.ready));
  });

  testWidgets('renders repository products without demo catalog data', (
    tester,
  ) async {
    final product = ProductModel(
      id: 'product-42',
      name: 'Real studio headphones',
      description: 'Loaded from the product repository',
      price: 1250000,
      imageUrl: '',
      stock: 8,
      categoryId: 'audio',
      categoryName: 'Audio',
      createdAt: DateTime(2026),
      updatedAt: DateTime(2026),
    );
    when(
      () => repository.getProducts(
        page: any(named: 'page'),
        limit: any(named: 'limit'),
        categoryId: any(named: 'categoryId'),
        searchQuery: any(named: 'searchQuery'),
        forceRefresh: any(named: 'forceRefresh'),
      ),
    ).thenAnswer((_) async => [product]);
    when(() => repository.getCategories()).thenAnswer(
      (_) async => const [CategoryModel(id: 'audio', name: 'Audio')],
    );

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
              ).copyWith(textScaler: const TextScaler.linear(2)),
              child: child!,
            ),
            home: const HomePage(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Real studio headphones'), findsOneWidget);
    expect(find.text('iPhone 15 Pro Max'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
