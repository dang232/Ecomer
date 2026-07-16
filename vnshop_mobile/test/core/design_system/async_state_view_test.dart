import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/design_system/components/async_state_view.dart';

void main() {
  group('resolveAsyncViewStatus', () {
    test('keeps stale data visible while it refreshes', () {
      expect(
        resolveAsyncViewStatus(
          isLoading: true,
          hasError: false,
          isEmpty: false,
          hasData: true,
        ),
        AsyncViewStatus.ready,
      );
    });

    test('does not report a failed request as empty', () {
      expect(
        resolveAsyncViewStatus(
          isLoading: false,
          hasError: true,
          isEmpty: true,
          hasData: false,
        ),
        AsyncViewStatus.error,
      );
    });
  });

  testWidgets('renders and announces each state independently', (tester) async {
    Future<void> pump(AsyncViewStatus status, {VoidCallback? onRetry}) {
      return tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AsyncStateView(
              status: status,
              loading: const Text('Loading products'),
              error: const Text('Products could not be loaded'),
              empty: const Text('No products yet'),
              retryLabel: 'Try again',
              onRetry: onRetry,
              child: const Text('Product results'),
            ),
          ),
        ),
      );
    }

    await pump(AsyncViewStatus.loading);
    expect(find.text('Loading products'), findsOneWidget);
    expect(find.bySemanticsLabel('Loading products'), findsOneWidget);

    var retried = false;
    await pump(AsyncViewStatus.error, onRetry: () => retried = true);
    expect(find.text('Products could not be loaded'), findsOneWidget);
    expect(find.text('No products yet'), findsNothing);
    await tester.tap(find.text('Try again'));
    expect(retried, isTrue);

    await pump(AsyncViewStatus.empty);
    expect(find.text('No products yet'), findsOneWidget);

    await pump(AsyncViewStatus.ready);
    expect(find.text('Product results'), findsOneWidget);
  });
}
