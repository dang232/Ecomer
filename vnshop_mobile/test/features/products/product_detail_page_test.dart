import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_state.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_bloc.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_event.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/presentation/pages/product_detail_page.dart';
import 'package:vnshop_mobile/features/reviews/presentation/bloc/review_cubit.dart';
import 'package:vnshop_mobile/features/reviews/presentation/bloc/review_state.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:vnshop_mobile/features/wishlist/presentation/bloc/wishlist_state.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockCartBloc extends MockBloc<CartEvent, CartState> implements CartBloc {}

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

class MockReviewCubit extends MockCubit<ReviewState> implements ReviewCubit {}

class MockWishlistCubit extends MockCubit<WishlistState>
    implements WishlistCubit {}

class FakeCartEvent extends Fake implements CartEvent {}

void main() {
  late MockCartBloc cartBloc;
  late MockAuthBloc authBloc;
  late MockReviewCubit reviewCubit;
  late MockWishlistCubit wishlistCubit;
  late ProductModel product;

  setUpAll(() {
    registerFallbackValue(FakeCartEvent());
  });

  setUp(() {
    cartBloc = MockCartBloc();
    authBloc = MockAuthBloc();
    reviewCubit = MockReviewCubit();
    wishlistCubit = MockWishlistCubit();
    product = ProductModel(
      id: 'product-42',
      name: 'Studio headphones',
      description: 'Closed-back monitoring headphones',
      price: 1250000,
      imageUrl: '',
      stock: 8,
      categoryId: 'audio',
      categoryName: '',
      createdAt: DateTime(2026),
      updatedAt: DateTime(2026),
    );

    when(
      () => cartBloc.state,
    ).thenReturn(const CartState(status: CartStatus.loaded));
    when(() => authBloc.state).thenReturn(const AuthState.unauthenticated());
    when(
      () => reviewCubit.state,
    ).thenReturn(const ReviewState(status: ReviewViewStatus.empty));
    when(
      () => wishlistCubit.state,
    ).thenReturn(const WishlistState(status: WishlistStatus.ready));
  });

  Future<void> pumpSubject(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<CartBloc>.value(value: cartBloc),
          BlocProvider<AuthBloc>.value(value: authBloc),
          BlocProvider<ReviewCubit>.value(value: reviewCubit),
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
          home: ProductDetailPage(product: product),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('adds the selected product through CartBloc without overflow', (
    tester,
  ) async {
    await pumpSubject(tester);

    await tester.tap(find.text('Add to cart'));
    await tester.pump();

    final event =
        verify(
              () => cartBloc.add(captureAny(that: isA<CartItemAdded>())),
            ).captured.single
            as CartItemAdded;
    expect(event.item.productId, 'product-42');
    expect(event.item.quantity, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('toggles the shared wishlist for an authenticated shopper', (
    tester,
  ) async {
    when(
      () => authBloc.state,
    ).thenReturn(const AuthState(status: AuthStatus.authenticated));
    when(
      () => wishlistCubit.toggle('product-42'),
    ).thenAnswer((_) async => true);

    await pumpSubject(tester);
    final favoriteButton = find.byTooltip(
      'Add to favorites',
      skipOffstage: false,
    );
    expect(favoriteButton, findsOneWidget);
    await tester.tap(favoriteButton);
    await tester.pump();

    verify(() => wishlistCubit.toggle('product-42')).called(1);
  });
}
