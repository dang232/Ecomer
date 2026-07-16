import 'package:dio/dio.dart';

import '../../domain/repositories/order_repository.dart';
import '../datasources/order_local_datasource.dart';
import '../datasources/order_remote_datasource.dart';
import '../models/order_model.dart';
import '../models/order_page_result.dart';

class OrderRepositoryImpl implements OrderRepository {
  final OrderRemoteDataSource _remoteDataSource;
  final OrderLocalDataSource _localDataSource;

  OrderRepositoryImpl({
    required this._remoteDataSource,
    required this._localDataSource,
  });

  @override
  Future<OrderPageResult> getOrders({
    int page = 1,
    int limit = 20,
    OrderStatus? status,
    bool forceRefresh = false,
  }) async {
    if (forceRefresh || page == 1) {
      try {
        final result = await _remoteDataSource.getOrders(
          page: page,
          limit: limit,
          status: status,
        );
        if (page == 1) await _localDataSource.cacheOrders(result.orders);
        return result;
      } on DioException {
        if (page == 1) {
          final cached = await _localDataSource.getCachedOrders();
          final filtered = status == null
              ? cached
              : cached.where((order) => order.status == status).toList();
          return OrderPageResult.singlePage(filtered);
        }
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
    final cachedOrder = await _localDataSource.getCachedOrder(orderId);
    try {
      final remoteOrder = await _remoteDataSource.getOrderById(orderId);
      final order = remoteOrder.mergeSummaryMetadata(cachedOrder);
      await _localDataSource.cacheOrder(order);
      return order;
    } on DioException {
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
      'shipping_city': ?shippingCity,
      'shipping_district': ?shippingDistrict,
      'shipping_ward': ?shippingWard,
      'note': ?note,
      'payment_method': ?paymentMethod,
    };

    final order = await _remoteDataSource.createOrder(orderData);
    await _localDataSource.cacheOrder(order);
    return order;
  }

  @override
  Future<OrderModel> cancelOrder(String orderId) async {
    final cachedOrder = await _localDataSource.getCachedOrder(orderId);
    final order = (await _remoteDataSource.cancelOrder(
      orderId,
    )).mergeSummaryMetadata(cachedOrder);
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
