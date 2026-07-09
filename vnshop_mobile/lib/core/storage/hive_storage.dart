import 'package:hive_ce_flutter/hive_flutter.dart';

class HiveStorage {
  const HiveStorage._();

  static const productsBox = 'products';
  static const cartBox = 'cart';
  static const ordersBox = 'orders';
  static const offlineQueueBox = 'offline_queue';

  static Future<void> initialize() async {
    await Hive.initFlutter();
    await Future.wait([
      Hive.openBox<dynamic>(productsBox),
      Hive.openBox<dynamic>(cartBox),
      Hive.openBox<dynamic>(ordersBox),
      Hive.openBox<dynamic>(offlineQueueBox),
    ]);
  }
}
