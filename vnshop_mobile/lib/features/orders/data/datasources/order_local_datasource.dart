import 'package:hive_ce/hive.dart';

import '../../../../core/storage/hive_storage.dart';
import '../models/order_model.dart';

abstract class OrderLocalDataSource {
  Future<List<OrderModel>> getCachedOrders();
  Future<OrderModel?> getCachedOrder(String orderId);
  Future<void> cacheOrders(List<OrderModel> orders);
  Future<void> cacheOrder(OrderModel order);
  Future<void> updateCachedOrder(OrderModel order);
  Future<void> clearCache();
}

class OrderLocalDataSourceImpl implements OrderLocalDataSource {
  final Box<dynamic> _ordersBox;

  OrderLocalDataSourceImpl({Box<dynamic>? ordersBox})
      : _ordersBox = ordersBox ?? Hive.box(HiveStorage.ordersBox);

  static const String _ordersKey = 'cached_orders';

  @override
  Future<List<OrderModel>> getCachedOrders() async {
    try {
      final ordersJson = _ordersBox.get(_ordersKey);
      if (ordersJson == null) return [];

      final List<dynamic> ordersList = ordersJson as List<dynamic>;
      return ordersList
          .map((e) => OrderModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (e) {
      return [];
    }
  }

  @override
  Future<OrderModel?> getCachedOrder(String orderId) async {
    try {
      final orders = await getCachedOrders();
      return orders.cast<OrderModel?>().firstWhere(
            (o) => o?.id == orderId,
            orElse: () => null,
          );
    } catch (e) {
      return null;
    }
  }

  @override
  Future<void> cacheOrders(List<OrderModel> orders) async {
    final ordersJson = orders.map((o) => o.toJson()).toList();
    await _ordersBox.put(_ordersKey, ordersJson);
  }

  @override
  Future<void> cacheOrder(OrderModel order) async {
    final orders = await getCachedOrders();
    final index = orders.indexWhere((o) => o.id == order.id);

    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.insert(0, order);
    }

    await cacheOrders(orders);
  }

  @override
  Future<void> updateCachedOrder(OrderModel order) async {
    await cacheOrder(order);
  }

  @override
  Future<void> clearCache() async {
    await _ordersBox.delete(_ordersKey);
  }
}
