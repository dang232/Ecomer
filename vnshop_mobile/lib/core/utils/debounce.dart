import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:bloc_concurrency/bloc_concurrency.dart';

/// Creates a debounce event transformer for BLoC
/// Combines debounce delay with restartable to cancel in-flight events and start fresh on new input
EventTransformer<T> debounceRestartable<T>(Duration duration) {
  return (events, mapper) {
    // Apply debounce first, then use restartable to cancel in-flight
    return restartable<T>().call(
      events.transform(_DebounceStreamTransformer(duration)),
      mapper,
    );
  };
}

/// Custom debounce stream transformer that delays events
class _DebounceStreamTransformer<T> extends StreamTransformerBase<T, T> {
  final Duration duration;
  _DebounceStreamTransformer(this.duration);

  @override
  Stream<T> bind(Stream<T> stream) {
    final controller = StreamController<T>();

    Timer? timer;
    T? lastValue;
    bool hasValue = false;

    stream.listen(
      (value) {
        lastValue = value;
        hasValue = true;
        timer?.cancel();
        timer = Timer(duration, () {
          if (hasValue && lastValue != null) {
            controller.add(lastValue as T);
            hasValue = false;
          }
        });
      },
      onError: controller.addError,
      onDone: () {
        timer?.cancel();
        if (hasValue && lastValue != null) {
          controller.add(lastValue as T);
        }
        controller.close();
      },
      cancelOnError: false,
    );

    return controller.stream;
  }
}
