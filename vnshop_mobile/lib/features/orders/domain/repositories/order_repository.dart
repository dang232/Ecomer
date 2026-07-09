import '../../data/models/order_model.dart';

abstract class OrderRepository {
  /// Lấy danh sách đơn hàng với caching
  Future<List<OrderModel>> getOrders({
    int page = 1,
    int limit = 20,
    OrderStatus? status,
    bool forceRefresh = false,
  });

  /// Lấy chi tiết đơn hàng
  Future<OrderModel> getOrderById(String orderId);

  /// Tạo đơn hàng mới
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
  });

  /// Hủy đơn hàng
  Future<OrderModel> cancelOrder(String orderId);

  /// Cập nhật trạng thái đơn hàng (internal use)
  Future<OrderModel> updateOrderStatus(String orderId, OrderStatus status);

  /// Lưu đơn hàng vào cache cục bộ
  Future<void> cacheOrder(OrderModel order);

  /// Xóa cache đơn hàng
  Future<void> clearCache();
}
