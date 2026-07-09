import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';

/// MoMo e-wallet payment service for Vietnam
/// MoMo has 41M+ active users, 1.5B transactions/year
/// API Docs: https://developers.momo.vn/
class MoMoService {
  MoMoService({
    required this.endpoint,
    required this.partnerCode,
    required this.accessKey,
    required this.secretKey,
    this.mode = MoMoMode.test,
  });

  final String endpoint;
  final String partnerCode;
  final String accessKey;
  final String secretKey;
  final MoMoMode mode;

  /// Create MoMo payment request
  /// amount: in VND (integer, min 1000)
  Future<MoMoPayment> createPayment({
    required int amount,
    required String orderId,
    required String orderInfo,
    required String returnUrl,
    required String notifyUrl,
    String? extraData,
  }) async {
    final requestId = '${DateTime.now().millisecondsSinceEpoch}';
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();

    final rawSignature = _buildSignature(
      partnerCode: partnerCode,
      accessKey: accessKey,
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      returnUrl: returnUrl,
      notifyUrl: notifyUrl,
      timestamp: timestamp,
    );

    final signature = _hashHmacSha256(rawSignature, secretKey);

    final requestBody = {
      'partnerCode': partnerCode,
      'partnerName': 'VNShop',
      'storeId': partnerCode,
      'requestId': requestId,
      'amount': amount,
      'orderId': orderId,
      'orderInfo': orderInfo,
      'orderType': 'momo_wallet',
      'redirectUrl': returnUrl,
      'ipnUrl': notifyUrl,
      'extraData': extraData ?? '',
      'requestType': 'captureWallet',
      'signature': signature,
      'lang': 'vi',
    };

    return MoMoPayment(
      orderId: orderId,
      requestId: requestId,
      paymentUrl: endpoint,
      requestBody: requestBody,
      amount: amount,
    );
  }

  /// Verify MoMo callback signature
  bool verifyCallback(Map<String, dynamic> data, String signature) {
    final rawSignature = _buildCallbackSignature(
      partnerCode: data['partnerCode'] ?? '',
      orderId: data['orderId'] ?? '',
      requestId: data['requestId'] ?? '',
      amount: data['amount']?.toString() ?? '',
      orderInfo: data['orderInfo'] ?? '',
      orderType: data['orderType'] ?? '',
      transId: data['transId']?.toString() ?? '',
      resultCode: data['resultCode']?.toString() ?? '',
    );

    final expectedSignature = _hashHmacSha256(rawSignature, secretKey);
    return signature == expectedSignature;
  }

  String _buildSignature({
    required String partnerCode,
    required String accessKey,
    required String requestId,
    required int amount,
    required String orderId,
    required String orderInfo,
    required String returnUrl,
    required String notifyUrl,
    required String timestamp,
  }) {
    return 'partnerCode=$partnerCode'
        '&accessKey=$accessKey'
        '&requestId=$requestId'
        '&amount=$amount'
        '&orderId=$orderId'
        '&orderInfo=$orderInfo'
        '&returnUrl=$returnUrl'
        '&notifyUrl=$notifyUrl'
        '&timestamp=$timestamp';
  }

  String _buildCallbackSignature({
    required String partnerCode,
    required String orderId,
    required String requestId,
    required String amount,
    required String orderInfo,
    required String orderType,
    required String transId,
    required String resultCode,
  }) {
    return 'partnerCode=$partnerCode'
        '&orderId=$orderId'
        '&requestId=$requestId'
        '&amount=$amount'
        '&orderInfo=$orderInfo'
        '&orderType=$orderType'
        '&transId=$transId'
        '&resultCode=$resultCode';
  }

  String _hashHmacSha256(String data, String key) {
    final hmacSha256 = Hmac(sha256, utf8.encode(key));
    final digest = hmacSha256.convert(utf8.encode(data));
    return digest.toString();
  }

  /// Generate unique order ID
  static String generateOrderId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = Random.secure().nextInt(999999).toString().padLeft(6, '0');
    return 'MOMO$timestamp$random';
  }
}

enum MoMoMode { test, production }

class MoMoPayment {
  final String orderId;
  final String requestId;
  final String paymentUrl;
  final Map<String, dynamic> requestBody;
  final int amount;

  const MoMoPayment({
    required this.orderId,
    required this.requestId,
    required this.paymentUrl,
    required this.requestBody,
    required this.amount,
  });
}

class MoMoCallback {
  final String orderId;
  final String requestId;
  final String transId;
  final int resultCode;
  final String message;
  final int? amount;
  final String? signature;

  const MoMoCallback({
    required this.orderId,
    required this.requestId,
    required this.transId,
    required this.resultCode,
    required this.message,
    this.amount,
    this.signature,
  });

  bool get isSuccess => resultCode == 0;

  factory MoMoCallback.fromJson(Map<String, dynamic> json) {
    return MoMoCallback(
      orderId: json['orderId'] ?? '',
      requestId: json['requestId'] ?? '',
      transId: json['transId']?.toString() ?? '',
      resultCode: json['resultCode'] ?? -1,
      message: json['message'] ?? '',
      amount: json['amount'],
      signature: json['signature'],
    );
  }
}
