import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/auth/session_controller.dart';

void main() {
  group('SessionController', () {
    test('expireSession clears tokens once', () async {
      bool cleared = false;
      final controller = SessionController(
        clearTokens: () async => cleared = true,
      );

      await controller.expireSession();
      await controller.expireSession(); // Second call should be no-op

      expect(cleared, true);
      expect(controller.isExpired, true);
    });

    test('reset clears expired flag', () async {
      bool cleared = false;
      final controller = SessionController(
        clearTokens: () async => cleared = true,
      );

      await controller.expireSession();
      controller.reset();

      expect(controller.isExpired, false);
    });

    test('onSessionExpired emits when expireSession called', () async {
      final controller = SessionController(
        clearTokens: () async {},
      );

      final events = <void>[];
      final subscription = controller.onSessionExpired.listen(events.add);

      await controller.expireSession();
      await Future.delayed(Duration.zero); // Let async event propagate

      expect(events.length, 1);

      await subscription.cancel();
      controller.dispose();
    });

    test('subsequent expireSession does not emit after first', () async {
      final controller = SessionController(
        clearTokens: () async {},
      );

      final events = <void>[];
      final subscription = controller.onSessionExpired.listen(events.add);

      await controller.expireSession();
      await Future.delayed(Duration.zero);
      await controller.expireSession();
      await Future.delayed(Duration.zero);

      expect(events.length, 1);

      await subscription.cancel();
      controller.dispose();
    });
  });
}
