import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/reviews/domain/entities/review.dart';
import 'package:vnshop_mobile/features/reviews/domain/repositories/review_repository.dart';
import 'package:vnshop_mobile/features/reviews/presentation/bloc/review_cubit.dart';
import 'package:vnshop_mobile/features/reviews/presentation/widgets/product_reviews_section.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockSectionReviewRepository extends Mock implements ReviewRepository {}

void main() {
  const productId = 'product-1';
  late MockSectionReviewRepository repository;

  Review approvedReview() => Review(
    id: 'review-1',
    productId: productId,
    buyerId: 'buyer-1',
    userName: 'Mai Nguyen',
    rating: 4,
    comment: 'The sound is clear and the fit is comfortable.',
    helpfulVotes: 3,
    verifiedPurchase: true,
    status: ReviewStatus.approved,
    createdAt: DateTime.utc(2026, 7, 15, 10, 31, 20),
  );

  setUp(() {
    repository = MockSectionReviewRepository();
  });

  Future<void> pumpSubject(
    WidgetTester tester, {
    required ReviewCubit cubit,
    bool authenticated = true,
    double textScale = 1,
  }) async {
    await tester.pumpWidget(
      BlocProvider.value(
        value: cubit,
        child: MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: Scaffold(
              body: SingleChildScrollView(
                child: ProductReviewsSection(
                  isAuthenticated: authenticated,
                  onLogin: () {},
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders live summary, readable date, and verified content', (
    tester,
  ) async {
    when(
      () => repository.getByProduct(productId),
    ).thenAnswer((_) async => [approvedReview()]);
    final cubit = ReviewCubit(repository: repository, productId: productId);
    await cubit.load();
    addTearDown(cubit.close);

    await pumpSubject(tester, cubit: cubit, textScale: 2);

    expect(find.text('Customer reviews'), findsOneWidget);
    expect(find.text('4.0'), findsOneWidget);
    expect(find.text('Verified purchase'), findsOneWidget);
    expect(find.text('Jul 15, 2026'), findsOneWidget);
    expect(find.text(approvedReview().comment!), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('submits a labeled rating and comment through the cubit', (
    tester,
  ) async {
    when(() => repository.getByProduct(productId)).thenAnswer((_) async => []);
    when(
      () => repository.create(
        productId: productId,
        rating: 3,
        comment: 'Useful review',
      ),
    ).thenAnswer((_) async => approvedReview());
    final cubit = ReviewCubit(repository: repository, productId: productId);
    await cubit.load();
    addTearDown(cubit.close);

    await pumpSubject(tester, cubit: cubit);
    await tester.tap(find.bySemanticsLabel('3 stars'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Your review'),
      'Useful review',
    );
    await tester.pump();
    expect(cubit.state.rating, 3);
    expect(cubit.state.comment, 'Useful review');
    await tester.tap(find.text('Submit review'));
    await tester.pumpAndSettle();

    verify(
      () => repository.create(
        productId: productId,
        rating: 3,
        comment: 'Useful review',
      ),
    ).called(1);
  });

  testWidgets('shows a retry action for load failures', (tester) async {
    var attempts = 0;
    when(() => repository.getByProduct(productId)).thenAnswer((_) async {
      attempts++;
      if (attempts == 1) throw Exception('offline');
      return [approvedReview()];
    });
    final cubit = ReviewCubit(repository: repository, productId: productId);
    await cubit.load();
    addTearDown(cubit.close);

    await pumpSubject(tester, cubit: cubit, authenticated: false);
    expect(find.text('Reviews could not be loaded'), findsOneWidget);

    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text(approvedReview().comment!), findsOneWidget);
    expect(attempts, 2);
  });
}
