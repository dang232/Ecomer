import 'dart:async';

/// Controller for managing authentication session lifecycle
/// Provides a centralized place to handle session expiration
class SessionController {
  SessionController({
    required Future<void> Function() clearTokens,
  }) : _clearTokens = clearTokens;

  final Future<void> Function() _clearTokens;

  final _sessionExpiredController = StreamController<void>.broadcast();

  /// Stream of session expiration events
  Stream<void> get onSessionExpired => _sessionExpiredController.stream;

  /// Guard to prevent multiple expireSession calls
  bool _sessionExpiredHandled = false;
  bool get _isExpired => _sessionExpiredHandled;

  /// Handle session expiration
  /// Only processes the first call; subsequent calls are no-ops
  Future<void> expireSession() async {
    if (_sessionExpiredHandled) return;
    _sessionExpiredHandled = true;

    await _clearTokens();
    _sessionExpiredController.add(null);
  }

  /// Reset the session controller (call after successful login)
  void reset() {
    _sessionExpiredHandled = false;
  }

  /// Check if session is marked as expired
  bool get isExpired => _sessionExpiredHandled;

  /// Dispose of resources
  void dispose() {
    _sessionExpiredController.close();
  }
}
