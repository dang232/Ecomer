import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive.dart';
import 'package:vnshop_mobile/core/storage/hive_storage.dart';

void main() {
  late Directory home;

  setUp(() async {
    home = await Directory.systemTemp.createTemp('vnshop_hive_test_');
    Hive.init(home.path);
  });

  tearDown(() async {
    await Hive.close();
    await home.delete(recursive: true);
  });

  test('recreates a corrupt box without deleting healthy boxes', () async {
    final healthy = await Hive.openBox<dynamic>(HiveStorage.cartBox);
    await healthy.put('cart', 'preserve-me');
    await healthy.close();

    final corruptFile = File('${home.path}${Platform.pathSeparator}${HiveStorage.productsBox}.hive');
    await corruptFile.writeAsBytes([0, 1, 2, 3, 4]);

    await expectLater(
      HiveStorage.initialize(initializeFlutter: false),
      completes,
    );

    expect(Hive.box<dynamic>(HiveStorage.productsBox).isEmpty, isTrue);
    expect(Hive.box<dynamic>(HiveStorage.cartBox).get('cart'), 'preserve-me');
  });
}
