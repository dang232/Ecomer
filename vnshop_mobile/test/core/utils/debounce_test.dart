import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/utils/debounce.dart';

void main() {
  group('debounceRestartable', () {
    test('delays events and only emits last one', () async {
      final transformer = debounceRestartable<int>(Duration(milliseconds: 100));
      final events = Stream<int>.fromIterable([1, 2, 3, 4, 5]);
      final results = <int>[];

      transformer(events, (e) async* {
        yield e;
      }).listen((dynamic v) => results.add(v as int));

      await Future.delayed(Duration(milliseconds: 200));

      expect(results.length, 1);
      expect(results.first, 5);
    });

    test('cancels previous events and restarts timer', () async {
      final transformer = debounceRestartable<int>(Duration(milliseconds: 50));
      final events = Stream<int>.fromIterable([1, 2, 3]);
      final results = <int>[];

      transformer(events, (e) async* {
        yield e;
      }).listen((dynamic v) => results.add(v as int));

      await Future.delayed(Duration(milliseconds: 150));

      expect(results.length, 1);
      expect(results.first, 3);
    });
  });
}
