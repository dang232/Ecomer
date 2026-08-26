import 'package:dio/dio.dart';

class ConfigurationClient {
  const ConfigurationClient({required this.dio});

  final Dio dio;

  Future<VietQRConfigurationData> getVietQRConfiguration() async {
    final response = await dio.get('/config/public');
    final root = response.data as Map<String, dynamic>;
    final payment = root['payment'] as Map<String, dynamic>?;
    final vietqr = payment?['vietqr'] as Map<String, dynamic>?;
    if (vietqr == null) {
      throw StateError('VietQR configuration is missing');
    }
    return VietQRConfigurationData(
      bankBin: vietqr['bankBin'] as String? ?? '',
      accountNumber: vietqr['accountNo'] as String? ?? '',
      accountName: vietqr['accountName'] as String? ?? '',
    );
  }
}

class VietQRConfigurationData {
  const VietQRConfigurationData({
    required this.bankBin,
    required this.accountNumber,
    required this.accountName,
  });

  final String bankBin;
  final String accountNumber;
  final String accountName;
}
