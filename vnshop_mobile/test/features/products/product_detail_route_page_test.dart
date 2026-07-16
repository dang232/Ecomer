import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:vnshop_mobile/features/products/data/models/product_model.dart';
import 'package:vnshop_mobile/features/products/domain/repositories/product_repository.dart';
import 'package:vnshop_mobile/features/products/presentation/pages/product_detail_route_page.dart';

class MockProductRepository extends Mock implements ProductRepository {}

void main() {
  late MockProductRepository repository;
  late ProductModel product;

  setUp(() {
    repository = MockProductRepository();
    product = ProductModel(
      id: 'product-42',
      name: 'Loaded product',
      description: 'A real product from the repository',
      price: 420000,
      imageUrl: '',
      stock: 4,
      categoryId: 'audio',
      categoryName: 'Audio',
      createdAt: DateTime(2026),
      updatedAt: DateTime(2026),
    );
  });

  Widget buildSubject({ProductModel? initialProduct}) {
    return Provider<ProductRepository>.value(
      value: repository,
      child: MaterialApp(
        home: ProductDetailRoutePage(
          productId: 'product-42',
          initialProduct: initialProduct,
          productBuilder: (context, value) => Text('ready:${value.name}'),
        ),
      ),
    );
  }

  testWidgets('loads a product by ID when a deep link has no extra object', (
    tester,
  ) async {
    when(
      () => repository.getProductById('product-42'),
    ).thenAnswer((_) async => product);

    await tester.pumpWidget(buildSubject());
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pump();
    expect(find.text('ready:Loaded product'), findsOneWidget);
    verify(() => repository.getProductById('product-42')).called(1);
  });

  testWidgets('uses a matching in-memory product without refetching', (
    tester,
  ) async {
    await tester.pumpWidget(buildSubject(initialProduct: product));
    await tester.pump();

    expect(find.text('ready:Loaded product'), findsOneWidget);
    verifyNever(() => repository.getProductById(any()));
  });

  testWidgets('shows a retryable error instead of an endless spinner', (
    tester,
  ) async {
    var attempts = 0;
    when(() => repository.getProductById('product-42')).thenAnswer((_) async {
      attempts++;
      if (attempts == 1) throw Exception('network unavailable');
      return product;
    });

    await tester.pumpWidget(buildSubject());
    await tester.pump();
    expect(find.text('Không thể tải sản phẩm'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);

    await tester.tap(find.text('Thử lại'));
    await tester.pump();
    await tester.pump();

    expect(find.text('ready:Loaded product'), findsOneWidget);
    expect(attempts, 2);
  });
}
