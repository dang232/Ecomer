import 'package:flutter/foundation.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

class HiveStorage {
  const HiveStorage._();

  static const productsBox = 'products';
  static const cartBox = 'cart';
  static const ordersBox = 'orders';
  static const offlineQueueBox = 'offline_queue';

  static Future<void> initialize({bool initializeFlutter = true}) async {
    if (initializeFlutter) await Hive.initFlutter();
    await Future.wait([
      _openBoxSafely(productsBox),
      _openBoxSafely(cartBox),
      _openBoxSafely(ordersBox),
      _openBoxSafely(offlineQueueBox),
    ]);
  }

  static Future<void> _openBoxSafely(String name) async {
    try {
      await Hive.openBox<dynamic>(name);
    } catch (error) {
      debugPrint('Hive box "$name" failed to open; recreating it: $error');
      await Hive.deleteBoxFromDisk(name);
      await Hive.openBox<dynamic>(name);
    }
  }
}
