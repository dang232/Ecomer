import '../../core/notifications/order_notification_service.dart';

typedef StartupTask = Future<void> Function();

class AppInitializer {
  AppInitializer({required List<StartupTask> tasks})
    : _tasks = List.unmodifiable(tasks);

  factory AppInitializer.production() {
    return AppInitializer(
      tasks: [OrderNotificationService.instance.initialize],
    );
  }

  final List<StartupTask> _tasks;
  Future<void>? _initialization;
  bool _isInitialized = false;

  bool get isInitialized => _isInitialized;

  Future<void> initialize() {
    if (_isInitialized) return Future<void>.value();
    return _initialization ??= _runTasks();
  }

  Future<void> _runTasks() async {
    try {
      for (final task in _tasks) {
        await task();
      }
      _isInitialized = true;
    } finally {
      if (!_isInitialized) _initialization = null;
    }
  }
}
