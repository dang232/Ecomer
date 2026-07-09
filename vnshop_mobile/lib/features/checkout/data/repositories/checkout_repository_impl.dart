import 'package:dio/dio.dart';

import '../../domain/repositories/checkout_repository.dart';
import '../models/address_model.dart';
import '../models/checkout_session.dart';
import '../models/payment_method.dart';
import '../models/payment_transaction.dart';
import '../models/shipping_quote.dart';

class CheckoutRepositoryImpl implements CheckoutRepository {
  final Dio _dio;
  final String _baseUrl;

  static const bool _useMockBackend =
      bool.fromEnvironment('USE_MOCK_BACKEND', defaultValue: false);

  CheckoutRepositoryImpl({
    required Dio dio,
    String? baseUrl,
  })  : _dio = dio,
        _baseUrl = baseUrl ?? 'https://api.vnshop.example.com';

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  @override
  List<PaymentMethod> getAvailablePaymentMethods() {
    return PaymentMethod.values;
  }

  @override
  Future<List<VietnamAddress>> getAddresses() async {
    if (_useMockBackend) {
      return _mockGetAddresses();
    }

    final response = await _dio.get(
      '/addresses',
      options: Options(headers: _headers),
    );

    return (response.data as List)
        .map((e) => VietnamAddress.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<VietnamAddress> addAddress(VietnamAddress address) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 300));
      return address.copyWith(id: 'addr_${DateTime.now().millisecondsSinceEpoch}');
    }

    final response = await _dio.post(
      '/addresses',
      options: Options(headers: _headers),
      data: address.toJson(),
    );

    return VietnamAddress.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<VietnamAddress> updateAddress(VietnamAddress address) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 300));
      return address;
    }

    final response = await _dio.put(
      '/addresses/${address.id}',
      options: Options(headers: _headers),
      data: address.toJson(),
    );

    return VietnamAddress.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> deleteAddress(String addressId) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 200));
      return;
    }

    await _dio.delete(
      '/addresses/$addressId',
      options: Options(headers: _headers),
    );
  }

  @override
  Future<void> setDefaultAddress(String addressId) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 200));
      return;
    }

    await _dio.patch(
      '/addresses/$addressId/default',
      options: Options(headers: _headers),
    );
  }

  @override
  Future<List<ShippingQuote>> getShippingQuotes(VietnamAddress address) async {
    if (_useMockBackend) {
      return _mockGetShippingQuotes(address);
    }

    final response = await _dio.get(
      '/shipping/quotes',
      options: Options(headers: _headers),
      queryParameters: {
        'city': address.city,
        'district': address.district,
        'ward': address.ward,
      },
    );

    return (response.data as List)
        .map((e) => ShippingQuote.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<CheckoutSession> createSession({
    required String userId,
    required double subtotal,
    double discountAmount = 0,
    String? couponCode,
  }) async {
    if (_useMockBackend) {
      return CheckoutSession.create(
        userId: userId,
        subtotal: subtotal,
        discountAmount: discountAmount,
        couponCode: couponCode,
      );
    }

    final response = await _dio.post(
      '/checkout/sessions',
      options: Options(headers: _headers),
      data: {
        'userId': userId,
        'subtotal': subtotal,
        'discountAmount': discountAmount,
        'couponCode': couponCode,
      },
    );

    return CheckoutSession.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<CheckoutSession> updateSession(CheckoutSession session) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 200));
      return session;
    }

    final response = await _dio.patch(
      '/checkout/sessions/${session.sessionId}',
      options: Options(headers: _headers),
      data: session.toJson(),
    );

    return CheckoutSession.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<PaymentTransaction> initiatePayment({
    required CheckoutSession session,
    required PaymentMethod method,
    required String idempotencyKey,
  }) async {
    if (_useMockBackend) {
      return _mockInitiatePayment(session, method, idempotencyKey);
    }

    final response = await _dio.post(
      '/payment/initiate',
      options: Options(
        headers: {
          ..._headers,
          'Idempotency-Key': idempotencyKey,
        },
      ),
      data: {
        'sessionId': session.sessionId,
        'method': method.name,
        'amount': session.totalAmount,
        'orderInfo': 'VNShop Order ${session.sessionId}',
      },
    );

    return PaymentTransaction.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<PaymentTransaction> getPaymentStatus(String transactionId) async {
    if (_useMockBackend) {
      return _mockGetPaymentStatus(transactionId);
    }

    final response = await _dio.get(
      '/payment/$transactionId/status',
      options: Options(headers: _headers),
    );

    return PaymentTransaction.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<PaymentTransaction> retryPayment({
    required String transactionId,
    required String newIdempotencyKey,
  }) async {
    if (_useMockBackend) {
      return _mockRetryPayment(transactionId, newIdempotencyKey);
    }

    final response = await _dio.post(
      '/payment/$transactionId/retry',
      options: Options(
        headers: {
          ..._headers,
          'Idempotency-Key': newIdempotencyKey,
        },
      ),
    );

    return PaymentTransaction.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<String> createOrder({
    required CheckoutSession session,
    required PaymentTransaction transaction,
  }) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 500));
      return 'ORD_${DateTime.now().millisecondsSinceEpoch}';
    }

    final response = await _dio.post(
      '/orders',
      options: Options(headers: _headers),
      data: {
        'session': session.toJson(),
        'transaction': transaction.toJson(),
      },
    );

    return response.data['orderId'] as String;
  }

  @override
  Future<void> cancelOrder(String orderId) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 300));
      return;
    }

    await _dio.post(
      '/orders/$orderId/cancel',
      options: Options(headers: _headers),
    );
  }

  // Mock implementations
  Future<List<VietnamAddress>> _mockGetAddresses() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return [
      VietnamAddress(
        id: 'addr_1',
        recipientName: 'Nguyễn Văn A',
        phoneNumber: '0901234567',
        streetAddress: '123 Đường ABC',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        isDefault: true,
      ),
      VietnamAddress(
        id: 'addr_2',
        recipientName: 'Trần Thị B',
        phoneNumber: '0912345678',
        streetAddress: '456 Đường XYZ',
        ward: 'Phường 2',
        district: 'Quận Bình Thạnh',
        city: 'TP. Hồ Chí Minh',
        isDefault: false,
      ),
    ];
  }

  Future<List<ShippingQuote>> _mockGetShippingQuotes(VietnamAddress address) async {
    await Future.delayed(const Duration(milliseconds: 400));

    // Calculate base shipping based on city
    double baseRate = 25000;
    if (address.city.toLowerCase().contains('hồ chí minh') ||
        address.city.toLowerCase().contains('hà nội')) {
      baseRate = 20000;
    }

    return [
      ShippingQuote(
        id: 'ship_1',
        name: 'Giao hàng nhanh',
        description: 'Giao hàng trong 1-2 ngày',
        price: baseRate,
        estimatedDays: 1,
        provider: ShippingProvider.giaoHangNhanh,
      ),
      ShippingQuote(
        id: 'ship_2',
        name: 'Giao hàng tiết kiệm',
        description: 'Giao hàng trong 2-4 ngày',
        price: baseRate * 0.7,
        estimatedDays: 3,
        provider: ShippingProvider.giaoHangTietKiem,
      ),
      ShippingQuote(
        id: 'ship_3',
        name: 'Viettel Post',
        description: 'Giao hàng trong 2-3 ngày',
        price: baseRate * 0.85,
        estimatedDays: 2,
        provider: ShippingProvider.viettelPost,
      ),
    ];
  }

  Future<PaymentTransaction> _mockInitiatePayment(
    CheckoutSession session,
    PaymentMethod method,
    String idempotencyKey,
  ) async {
    await Future.delayed(const Duration(milliseconds: 500));

    final now = DateTime.now();
    String? paymentUrl;
    String? qrCodeUrl;

    switch (method) {
      case PaymentMethod.vnpay:
        paymentUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?mock=true';
        break;
      case PaymentMethod.momo:
        paymentUrl = 'momo://payment?mock=true';
        qrCodeUrl = 'https://api.vietqr.io/image/momo-mock?mock=true';
        break;
      case PaymentMethod.vietqr:
        qrCodeUrl = 'https://api.vietqr.io/image/mock-bank?mock=true';
        break;
      case PaymentMethod.cod:
      case PaymentMethod.bankTransfer:
        break;
    }

    return PaymentTransaction(
      id: 'txn_${now.millisecondsSinceEpoch}',
      orderId: session.sessionId,
      idempotencyKey: idempotencyKey,
      method: method,
      status: PaymentStatus.pending,
      amount: session.totalAmount,
      paymentUrl: paymentUrl,
      qrCodeUrl: qrCodeUrl,
      createdAt: now,
      attemptCount: 1,
    );
  }

  Future<PaymentTransaction> _mockGetPaymentStatus(String transactionId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return PaymentTransaction(
      id: transactionId,
      orderId: 'order_mock',
      idempotencyKey: 'mock_key',
      method: PaymentMethod.vnpay,
      status: PaymentStatus.pending,
      amount: 100000,
      createdAt: DateTime.now(),
    );
  }

  Future<PaymentTransaction> _mockRetryPayment(
    String transactionId,
    String newIdempotencyKey,
  ) async {
    await Future.delayed(const Duration(milliseconds: 500));
    return PaymentTransaction(
      id: 'txn_${DateTime.now().millisecondsSinceEpoch}',
      orderId: 'order_mock',
      idempotencyKey: newIdempotencyKey,
      method: PaymentMethod.vnpay,
      status: PaymentStatus.pending,
      amount: 100000,
      createdAt: DateTime.now(),
      attemptCount: 2,
    );
  }
}
