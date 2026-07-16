import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/app/bootstrap/app_initializer.dart';

void main() {
  test(
    'startup tasks run once even when initialization is requested concurrently',
    () async {
      var calls = 0;
      final initializer = AppInitializer(
        tasks: [
          () async {
            calls++;
            await Future<void>.delayed(Duration.zero);
          },
        ],
      );

      await Future.wait([initializer.initialize(), initializer.initialize()]);
      await initializer.initialize();

      expect(calls, 1);
      expect(initializer.isInitialized, isTrue);
    },
  );
}
