import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/wishlist/data/datasources/wishlist_remote_data_source.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late WishlistRemoteDataSourceImpl dataSource;

  setUp(() {
    dio = MockDio();
    dataSource = WishlistRemoteDataSourceImpl(dio: dio);
  });

  test('reads product IDs from the wishlist API envelope', () async {
    when(() => dio.get('/users/me/wishlist')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/users/me/wishlist'),
        statusCode: 200,
        data: const {
          'success': true,
          'data': {
            'productIds': ['product-1', 'product-2'],
            'items': [],
          },
        },
      ),
    );

    expect(await dataSource.getProductIds(), ['product-1', 'product-2']);
  });

  test('returns the server-authoritative state after a toggle', () async {
    when(
      () => dio.post('/users/me/wishlist/toggle', data: any(named: 'data')),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/users/me/wishlist/toggle'),
        statusCode: 200,
        data: const {
          'success': true,
          'data': {
            'productId': 'product-1',
            'changed': true,
            'inWishlist': true,
          },
        },
      ),
    );

    expect(await dataSource.toggle('product-1'), isTrue);
    final body =
        verify(
              () => dio.post(
                '/users/me/wishlist/toggle',
                data: captureAny(named: 'data'),
              ),
            ).captured.single
            as Map<String, dynamic>;
    expect(body, {'productId': 'product-1'});
  });
}
