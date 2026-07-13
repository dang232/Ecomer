import 'package:dio/dio.dart';

import '../models/order_model.dart';

abstract class OrderRemoteDataSource {
  Future<List<OrderModel>> getOrders({int page, int limit, OrderStatus? status});
  Future<OrderModel> getOrderById(String orderId);
  Future<OrderModel> createOrder(Map<String, dynamic> orderData);
  Future<OrderModel> cancelOrder(String orderId);
}

class OrderRemoteDataSourceImpl implements OrderRemoteDataSource {
  final Dio _dio;

  OrderRemoteDataSourceImpl({required Dio dio}) : _dio = dio;

  @override
  Future<List<OrderModel>> getOrders({
    int page = 1,
    int limit = 20,
    OrderStatus? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page - 1,
        'size': limit,
        if (status != null) 'status': status.value,
      };
      final response = await _dio.get(
        '/orders',
        queryParameters: queryParams,
      );

      if (response.statusCode != 200) {
        throw DioException(
          requestOptions: response.requestOptions,
          message: 'Unable to load orders',
        );
      }

      final envelope = response.data as Map<String, dynamic>;
      final rawData = envelope['data'] ?? envelope['orders'] ?? const [];
      final rawOrders = rawData is Map<String, dynamic>
          ? (rawData['content'] as List<dynamic>? ?? const [])
          : rawData as List<dynamic>;
      return rawOrders
          .map((item) => OrderModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/orders'),
        message: 'Unable to load orders: $e',
      );
    }
  }

  @override
  Future<OrderModel> getOrderById(String orderId) async {
    try {
      final response = await _dio.get('/orders/$orderId');
      if (response.statusCode != 200) {
        throw DioException(
          requestOptions: response.requestOptions,
          message: 'Unable to load order',
        );
      }
      return OrderModel.fromJson(_mapPayload(response.data));
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/orders/$orderId'),
        message: 'Unable to load order: $e',
      );
    }
  }

  @override
  Future<OrderModel> createOrder(Map<String, dynamic> orderData) async {
    try {
      final response = await _dio.post('/orders', data: orderData);
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw DioException(
          requestOptions: response.requestOptions,
          message: 'Unable to create order',
        );
      }
      return OrderModel.fromJson(_mapPayload(response.data));
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/orders'),
        message: 'Unable to create order: $e',
      );
    }
  }

  @override
  Future<OrderModel> cancelOrder(String orderId) async {
    try {
      final response = await _dio.delete('/orders/$orderId/cancel');
      if (response.statusCode != 200) {
        throw DioException(
          requestOptions: response.requestOptions,
          message: 'Unable to cancel order',
        );
      }
      return OrderModel.fromJson(_mapPayload(response.data));
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/orders/$orderId/cancel'),
        message: 'Unable to cancel order: $e',
      );
    }
  }

  Map<String, dynamic> _mapPayload(Object? rawResponse) {
    final envelope = rawResponse as Map<String, dynamic>;
    final data = envelope['data'] ?? envelope['order'] ?? envelope;
    return data as Map<String, dynamic>;
  }
}
