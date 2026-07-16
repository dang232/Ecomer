import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/products/data/datasources/product_remote_datasource.dart';
import 'package:vnshop_mobile/features/products/domain/models/product_catalog_query.dart';

class MockDio extends Mock implements Dio {}

void main() {
  test('reads a product from the API response envelope', () async {
    final dio = MockDio();
    when(() => dio.get(any())).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/products/product-42'),
        statusCode: 200,
        data: const {
          'success': true,
          'data': {
            'id': 'product-42',
            'name': 'Studio headphones',
            'description': 'Closed-back monitoring headphones',
            'categoryId': 'audio',
            'status': 'ACTIVE',
            'stock': 8,
            'variants': [
              {
                'sku': 'HEADPHONES-BLACK',
                'name': 'Black',
                'priceAmount': 1250000,
                'priceCurrency': 'VND',
                'imageUrl': 'https://cdn.example.com/headphones.png',
                'stockQuantity': 8,
              },
            ],
            'images': [
              {
                'url': 'https://cdn.example.com/headphones-detail.png',
                'alt': 'Headphones side view',
                'sortOrder': 0,
              },
            ],
          },
        },
      ),
    );

    final product = await ProductRemoteDataSourceImpl(
      dio: dio,
      baseUrl: '/products',
    ).getProductById('product-42');

    expect(product.id, 'product-42');
    expect(product.name, 'Studio headphones');
    expect(product.price, 1250000);
    expect(product.stock, 8);
    expect(product.imageUrl, 'https://cdn.example.com/headphones.png');
    expect(product.images, ['https://cdn.example.com/headphones-detail.png']);
  });

  test(
    'queries the search service with normalized catalog parameters',
    () async {
      final dio = MockDio();
      when(
        () =>
            dio.get('/search', queryParameters: any(named: 'queryParameters')),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/search'),
          statusCode: 200,
          data: const {
            'success': true,
            'data': {
              'content': [
                {
                  'id': 'product-42',
                  'name': 'Studio headphones',
                  'description': 'Closed-back monitoring headphones',
                  'categoryId': 'audio',
                  'status': 'ACTIVE',
                  'price': 1250000,
                  'imageUrl': 'https://cdn.example.com/headphones.png',
                  'stock': 8,
                },
              ],
            },
          },
        ),
      );
      final dataSource = ProductRemoteDataSourceImpl(
        dio: dio,
        baseUrl: '/products',
        searchBaseUrl: '/search',
      );

      final products = await dataSource.getProducts(
        page: 1,
        limit: 24,
        categoryId: 'audio',
        searchQuery: ' headphones ',
        filters: const ProductCatalogFilters(
          minPrice: 1000000,
          maxPrice: 2000000,
          sameDayOnly: true,
          verifiedOnly: true,
          officialOnly: true,
        ),
        sort: ProductSort.priceLowToHigh,
      );

      expect(
        products.single.imageUrl,
        'https://cdn.example.com/headphones.png',
      );
      expect(products.single.stock, 8);
      final captured =
          verify(
                () => dio.get(
                  '/search',
                  queryParameters: captureAny(named: 'queryParameters'),
                ),
              ).captured.single
              as Map<String, dynamic>;
      expect(captured, {
        'page': 0,
        'size': 24,
        'q': 'headphones',
        'category': 'audio',
        'minPrice': 1000000,
        'maxPrice': 2000000,
        'sort': 'price-low',
        'sameDay': true,
        'verifiedOnly': true,
        'officialOnly': true,
      });
    },
  );
}
