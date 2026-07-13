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
    if (forceRefresh || page == 1) {
      try {
        final orders = await _remoteDataSource.getOrders(
          page: page,
          limit: limit,
          status: status,
        );
        if (page == 1) await _localDataSource.cacheOrders(orders);
        return orders;
      } on DioException {
        if (page == 1) return _localDataSource.getCachedOrders();
        rethrow;
      }
    }

    return _remoteDataSource.getOrders(
      page: page,
      limit: limit,
      status: status,
    );
  }

  @override
  Future<OrderModel> getOrderById(String orderId) async {
    try {
      final cachedOrder = await _localDataSource.getCachedOrder(orderId);
      if (cachedOrder != null) return cachedOrder;

      final order = await _remoteDataSource.getOrderById(orderId);
      await _localDataSource.cacheOrder(order);
      return order;
    } on DioException {
      final cachedOrder = await _localDataSource.getCachedOrder(orderId);
      if (cachedOrder != null) return cachedOrder;
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
    await _localDataSource.cacheOrder(order);
    return order;
  }

  @override
  Future<OrderModel> cancelOrder(String orderId) async {
    final order = await _remoteDataSource.cancelOrder(orderId);
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
