import 'package:dio/dio.dart';

import '../../domain/repositories/order_repository.dart';
import '../datasources/order_local_datasource.dart';
import '../datasources/order_remote_datasource.dart';
import '../models/order_model.dart';

class OrderRepositoryImpl implements OrderRepository {
  final OrderRemoteDataSource _remoteDataSource;
  final OrderLocalDataSource _localDataSource;

  OrderRepositoryImpl({
    required OrderRemoteDataSource remoteDataSource,
    required OrderLocalDataSource localDataSource,
  })  : _remoteDataSource = remoteDataSource,
        _localDataSource = localDataSource;

  @override
  Future<List<OrderModel>> getOrders({
    int page = 1,
    int limit = 20,
    OrderStatus? status,
    bool forceRefresh = false,
  }) async {
    // Nếu force refresh hoặc trang đầu tiên, lấy từ server
    if (forceRefresh || page == 1) {
      try {
        final orders = await _remoteDataSource.getOrders(
          page: page,
          limit: limit,
          status: status,
        );

        // Cache orders nếu là trang đầu
        if (page == 1) {
          await _localDataSource.cacheOrders(orders);
        }

        return orders;
      } on DioException {
        // Nếu có lỗi mạng, trả về cache
        if (page == 1) {
          return _localDataSource.getCachedOrders();
        }
        rethrow;
      }
    }

    // Các trang tiếp theo lấy từ server
    return _remoteDataSource.getOrders(
      page: page,
      limit: limit,
      status: status,
    );
  }

  @override
  Future<OrderModel> getOrderById(String orderId) async {
    try {
      // Thử lấy từ cache trước
      final cachedOrder = await _localDataSource.getCachedOrder(orderId);
      if (cachedOrder != null) {
        return cachedOrder;
      }

      // Lấy từ server
      final order = await _remoteDataSource.getOrderById(orderId);

      // Cache order
      await _localDataSource.cacheOrder(order);

      return order;
    } on DioException {
      // Nếu có lỗi mạng, thử lấy từ cache
      final cachedOrder = await _localDataSource.getCachedOrder(orderId);
      if (cachedOrder != null) {
        return cachedOrder;
      }
      rethrow;
    }
  }

  @override
  Future<OrderModel> createOrder({
    required List<Map<String, dynamic>> items,
    required String shippingName,
    required String shippingPhone,
    required String shippingAddress,
    String? shippingCity,
    String? shippingDistrict,
    String? shippingWard,
    String? note,
    String? paymentMethod,
  }) async {
    final orderData = {
      'items': items,
      'shipping_name': shippingName,
      'shipping_phone': shippingPhone,
      'shipping_address': shippingAddress,
      if (shippingCity != null) 'shipping_city': shippingCity,
      if (shippingDistrict != null) 'shipping_district': shippingDistrict,
      if (shippingWard != null) 'shipping_ward': shippingWard,
      if (note != null) 'note': note,
      if (paymentMethod != null) 'payment_method': paymentMethod,
    };

    final order = await _remoteDataSource.createOrder(orderData);

    // Cache order mới
    await _localDataSource.cacheOrder(order);

    return order;
  }

  @override
  Future<OrderModel> cancelOrder(String orderId) async {
    final order = await _remoteDataSource.cancelOrder(orderId);

    // Cập nhật cache
    await _localDataSource.updateCachedOrder(order);

    return order;
  }

  @override
  Future<OrderModel> updateOrderStatus(String orderId, OrderStatus status) async {
    final order = await _remoteDataSource.updateOrderStatus(orderId, status);

    // Cập nhật cache
    await _localDataSource.updateCachedOrder(order);

    return order;
  }

  @override
  Future<void> cacheOrder(OrderModel order) async {
    await _localDataSource.cacheOrder(order);
  }

  @override
  Future<void> clearCache() async {
    await _localDataSource.clearCache();
  }
}
