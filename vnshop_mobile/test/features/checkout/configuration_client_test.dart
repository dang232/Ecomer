import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/core/config/configuration_client.dart';

class ConfigurationDio extends Mock implements Dio {}

void main() {
  test('reads VietQR destination from the public configuration contract', () async {
    final dio = ConfigurationDio();
    when(() => dio.get('/config/public')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/config/public'),
        statusCode: 200,
        data: const {
          'payment': {
            'vietqr': {
              'bankBin': '970407',
              'accountNo': '0123456789',
              'accountName': 'VNShop',
            },
          },
        },
      ),
    );

    final config = await ConfigurationClient(dio: dio).getVietQRConfiguration();

    expect(config.bankBin, '970407');
    expect(config.accountNumber, '0123456789');
    expect(config.accountName, 'VNShop');
  });

  test('fails closed when public payment configuration is absent', () async {
    final dio = ConfigurationDio();
    when(() => dio.get('/config/public')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/config/public'),
        statusCode: 200,
        data: const <String, dynamic>{},
      ),
    );

    expect(
      () => ConfigurationClient(dio: dio).getVietQRConfiguration(),
      throwsA(isA<StateError>()),
    );
  });
}
