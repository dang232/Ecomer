import 'package:dio/dio.dart';

import '../models/order_model.dart';

abstract class OrderRemoteDataSource {
  Future<List<OrderModel>> getOrders({int page, int limit, OrderStatus? status});
  Future<OrderModel> getOrderById(String orderId);
  Future<OrderModel> createOrder(Map<String, dynamic> orderData);
  Future<OrderModel> cancelOrder(String orderId);
  Future<OrderModel> updateOrderStatus(String orderId, OrderStatus status);
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
        'page': page,
        'limit': limit,
      };

      if (status != null) {
        queryParams['status'] = status.value;
      }

      final response = await _dio.get(
        '/api/orders',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final List<dynamic> ordersJson = data['data'] ?? data['orders'] ?? [];
        return ordersJson
            .map((e) => OrderModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Không thể tải danh sách đơn hàng',
      );
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/orders'),
        message: 'Lỗi khi lấy danh sách đơn hàng: $e',
      );
    }
  }

  @override
  Future<OrderModel> getOrderById(String orderId) async {
    try {
      final response = await _dio.get('/api/orders/$orderId');

      if (response.statusCode == 200) {
        final data = response.data;
        return OrderModel.fromJson(
            data['data'] ?? data['order'] ?? data as Map<String, dynamic>);
      }

      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Không thể tải thông tin đơn hàng',
      );
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/orders/$orderId'),
        message: 'Lỗi khi lấy thông tin đơn hàng: $e',
      );
    }
  }

  @override
  Future<OrderModel> createOrder(Map<String, dynamic> orderData) async {
    try {
      final response = await _dio.post(
        '/api/orders',
        data: orderData,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        return OrderModel.fromJson(
            data['data'] ?? data['order'] ?? data as Map<String, dynamic>);
      }

      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Không thể tạo đơn hàng',
      );
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/orders'),
        message: 'Lỗi khi tạo đơn hàng: $e',
      );
    }
  }

  @override
  Future<OrderModel> cancelOrder(String orderId) async {
    try {
      final response = await _dio.post('/api/orders/$orderId/cancel');

      if (response.statusCode == 200) {
        final data = response.data;
        return OrderModel.fromJson(
            data['data'] ?? data['order'] ?? data as Map<String, dynamic>);
      }

      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Không thể hủy đơn hàng',
      );
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/orders/$orderId/cancel'),
        message: 'Lỗi khi hủy đơn hàng: $e',
      );
    }
  }

  @override
  Future<OrderModel> updateOrderStatus(String orderId, OrderStatus status) async {
    try {
      final response = await _dio.patch(
        '/api/orders/$orderId',
        data: {'status': status.value},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        return OrderModel.fromJson(
            data['data'] ?? data['order'] ?? data as Map<String, dynamic>);
      }

      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Không thể cập nhật trạng thái đơn hàng',
      );
    } on DioException {
      rethrow;
    } catch (e) {
      throw DioException(
        requestOptions: RequestOptions(path: '/api/orders/$orderId'),
        message: 'Lỗi khi cập nhật trạng thái: $e',
      );
    }
  }
}
