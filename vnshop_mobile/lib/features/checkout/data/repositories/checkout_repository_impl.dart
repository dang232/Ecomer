import 'package:dio/dio.dart';

import '../../domain/repositories/checkout_repository.dart';
import '../models/address_model.dart';
import '../models/checkout_session.dart';
import '../models/payment_transaction.dart';
import '../models/shipping_quote.dart';

class CheckoutRepositoryImpl implements CheckoutRepository {
  final Dio _dio;

  static const bool _useMockBackend = bool.fromEnvironment(
    'USE_MOCK_BACKEND',
    defaultValue: false,
  );

  CheckoutRepositoryImpl({required this._dio});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  @override
  Future<List<PaymentMethod>> getAvailablePaymentMethods() async {
    if (_useMockBackend) {
      return const [PaymentMethod.cod, PaymentMethod.vietqr];
    }

    final response = await _dio.get(
      '/payment/methods',
      options: Options(headers: _headers),
    );
    final responseData = response.data as Map<String, dynamic>;
    final methods = responseData['data'] as List<dynamic>? ?? const [];

    return methods
        .whereType<Map>()
        .where((method) => method['enabled'] != false)
        .map((method) => _paymentMethodFromId(method['id'] as String?))
        .whereType<PaymentMethod>()
        .toList(growable: false);
  }

  PaymentMethod? _paymentMethodFromId(String? id) {
    return switch (id?.toLowerCase()) {
      'cod' => PaymentMethod.cod,
      'vietqr' || 'viet_qr' => PaymentMethod.vietqr,
      'vnpay' => PaymentMethod.vnpay,
      'momo' => PaymentMethod.momo,
      'bank_transfer' => PaymentMethod.bankTransfer,
      _ => null,
    };
  }

  @override
  Future<List<VietnamAddress>> getAddresses() async {
    if (_useMockBackend) {
      return _mockGetAddresses();
    }

    final response = await _dio.get(
      '/users/me',
      options: Options(headers: _headers),
    );

    final responseData = response.data as Map<String, dynamic>;
    return _addressesFromProfile(responseData['data'] as Map<String, dynamic>);
  }

  @override
  Future<VietnamAddress> addAddress(VietnamAddress address) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 300));
      return address.copyWith(
        id: 'addr_${DateTime.now().millisecondsSinceEpoch}',
      );
    }

    final response = await _dio.post(
      '/users/me/addresses',
      options: Options(headers: _headers),
      data: address.toBackendJson(),
    );

    final responseData = response.data as Map<String, dynamic>;
    final addresses = _addressesFromProfile(
      responseData['data'] as Map<String, dynamic>,
    );
    if (addresses.isEmpty) {
      throw StateError('address was not returned by the server');
    }
    return addresses.last;
  }

  @override
  Future<VietnamAddress> updateAddress(VietnamAddress address) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 300));
      return address;
    }

    final response = await _dio.put(
      '/users/me/addresses/${address.id}',
      options: Options(headers: _headers),
      data: address.toBackendJson(),
    );

    final responseData = response.data as Map<String, dynamic>;
    final addresses = _addressesFromProfile(
      responseData['data'] as Map<String, dynamic>,
    );
    final index = int.tryParse(address.id);
    if (index == null || index < 0 || index >= addresses.length) {
      throw StateError('updated address was not returned by the server');
    }
    return addresses[index];
  }

  @override
  Future<void> deleteAddress(String addressId) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 200));
      return;
    }

    await _dio.delete(
      '/users/me/addresses/$addressId',
      options: Options(headers: _headers),
    );
  }

  @override
  Future<void> setDefaultAddress(String addressId) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 200));
      return;
    }

    await _dio.put(
      '/users/me/addresses/$addressId/default',
      options: Options(headers: _headers),
    );
  }

  @override
  Future<List<ShippingQuote>> getShippingQuotes(VietnamAddress address) async {
    if (_useMockBackend) {
      return _mockGetShippingQuotes(address);
    }

    final response = await _dio.post(
      '/checkout/shipping-options',
      options: Options(headers: _headers),
      data: {
        'address': {
          'street': address.streetAddress,
          'ward': address.ward,
          'district': address.district,
          'city': address.city,
        },
      },
    );

    // Backend returns ApiResponse envelope: { data: [{ method, cost, estimate }] }
    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as List<dynamic>;

    return data
        .map((e) => ShippingQuote.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<CheckoutSession> createSession({
    required String userId,
    required List<LineItem> lineItems,
    required double subtotal,
    double discountAmount = 0,
    String? couponCode,
  }) async {
    if (_useMockBackend) {
      return CheckoutSession.create(
        userId: userId,
        lineItems: lineItems,
        subtotal: subtotal,
        discountAmount: discountAmount,
        couponCode: couponCode,
      );
    }

    final response = await _dio.post(
      '/checkout/calculate',
      options: Options(headers: _headers),
      data: {
        'items': lineItems.map((item) => item.toJson()).toList(),
        'couponCode': couponCode,
      },
    );

    // Backend returns ApiResponse envelope: { data: { ...CheckoutBreakdownResponse... } }
    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;

    return CheckoutSession.fromBreakdown(
      userId: userId,
      lineItems: lineItems,
      breakdown: data,
      subtotalFallback: subtotal,
      discountFallback: discountAmount,
      couponCode: couponCode,
    );
  }

  @override
  Future<CheckoutSession> updateSession(CheckoutSession session) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 200));
      return session;
    }

    final response = await _dio.post(
      '/checkout/calculate',
      options: Options(headers: _headers),
      data: {
        'items': session.lineItems.map((item) => item.toJson()).toList(),
        'couponCode': session.couponCode,
      },
    );

    // Backend returns ApiResponse envelope: { data: { ... } }
    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;

    final recalculated = CheckoutSession.fromBreakdown(
      userId: session.userId,
      lineItems: session.lineItems,
      breakdown: data,
      subtotalFallback: session.subtotal,
      discountFallback: session.discountAmount,
      couponCode: session.couponCode,
    );
    return session.copyWith(
      subtotal: recalculated.subtotal,
      shippingFee: recalculated.shippingFee,
      discountAmount: recalculated.discountAmount,
      totalAmount: recalculated.totalAmount,
    );
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

    // Map PaymentMethod to backend endpoint
    final String endpoint;
    switch (method) {
      case PaymentMethod.vnpay:
        endpoint = '/payment/vnpay/create';
        break;
      case PaymentMethod.momo:
        endpoint = '/payment/momo/create';
        break;
      case PaymentMethod.vietqr:
        endpoint = '/payment/vietqr/create';
        break;
      case PaymentMethod.cod:
        endpoint = '/payment/cod/confirm';
        break;
      case PaymentMethod.bankTransfer:
        // Bank transfer uses VietQR
        endpoint = '/payment/vietqr/create';
        break;
    }

    final response = await _dio.post(
      endpoint,
      options: Options(
        headers: {..._headers, 'Idempotency-Key': idempotencyKey},
      ),
      data: {'orderId': session.sessionId},
    );

    // Backend returns ApiResponse envelope: { data: { ... } }
    final responseData = response.data as Map<String, dynamic>;
    return PaymentTransaction.fromApiResponse(responseData);
  }

  @override
  Future<PaymentTransaction> getPaymentStatus(String orderId) async {
    if (_useMockBackend) {
      return _mockGetPaymentStatus(orderId);
    }

    final response = await _dio.get(
      '/payment/status/$orderId',
      options: Options(headers: _headers),
    );

    return PaymentTransaction.fromApiResponse(
      response.data as Map<String, dynamic>,
    );
  }

  @override
  Future<String> createOrder({
    required CheckoutSession session,
    required PaymentTransaction transaction,
    required String idempotencyKey,
  }) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 500));
      return 'ORD_${DateTime.now().millisecondsSinceEpoch}';
    }

    // Map PaymentMethod enum to backend string values
    String paymentMethodString;
    switch (transaction.method) {
      case PaymentMethod.cod:
        paymentMethodString = 'COD';
        break;
      case PaymentMethod.vnpay:
        paymentMethodString = 'VNPAY';
        break;
      case PaymentMethod.momo:
        paymentMethodString = 'MOMO';
        break;
      case PaymentMethod.vietqr:
      case PaymentMethod.bankTransfer:
        paymentMethodString = 'VIETQR';
    }

    final response = await _dio.post(
      '/orders',
      options: Options(
        headers: {..._headers, 'Idempotency-Key': idempotencyKey},
      ),
      data: {
        'shippingAddress': {
          'street': session.selectedAddress?.streetAddress,
          'ward': session.selectedAddress?.ward,
          'district': session.selectedAddress?.district,
          'city': session.selectedAddress?.city,
        },
        'items': session.lineItems.map((item) => item.toJson()).toList(),
        'paymentMethod': paymentMethodString,
      },
    );

    // Backend returns ApiResponse envelope: { data: { id: "order-id", ... } }
    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;
    return data['id'] as String;
  }

  @override
  Future<void> cancelOrder(String orderId) async {
    if (_useMockBackend) {
      await Future.delayed(const Duration(milliseconds: 300));
      return;
    }

    await _dio.delete(
      '/orders/$orderId/cancel',
      options: Options(headers: _headers),
    );
  }

  List<VietnamAddress> _addressesFromProfile(
    Map<String, dynamic> responseData,
  ) {
    final addresses = responseData['addresses'] as List<dynamic>? ?? const [];
    final name = responseData['name'] as String? ?? '';
    final phone = responseData['phone'] as String? ?? '';
    return [
      for (var index = 0; index < addresses.length; index++)
        VietnamAddress.fromBackendJson(
          addresses[index] as Map<String, dynamic>,
          index: index,
          recipientName: name,
          phoneNumber: phone,
        ),
    ];
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

  Future<List<ShippingQuote>> _mockGetShippingQuotes(
    VietnamAddress address,
  ) async {
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
        cost: baseRate,
        method: 'EXPRESS',
        estimate: '1-2 days',
        estimatedDays: 1,
        provider: ShippingProvider.giaoHangNhanh,
      ),
      ShippingQuote(
        id: 'ship_2',
        name: 'Giao hàng tiết kiệm',
        description: 'Giao hàng trong 2-4 ngày',
        price: baseRate * 0.7,
        cost: baseRate * 0.7,
        method: 'STANDARD',
        estimate: '3-5 days',
        estimatedDays: 3,
        provider: ShippingProvider.giaoHangTietKiem,
      ),
      ShippingQuote(
        id: 'ship_3',
        name: 'Viettel Post',
        description: 'Giao hàng trong 2-3 ngày',
        price: baseRate * 0.85,
        cost: baseRate * 0.85,
        method: 'STANDARD',
        estimate: '2-3 days',
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
        paymentUrl =
            'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?mock=true';
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
}
