import 'package:equatable/equatable.dart';

/// TokenSet model containing access and refresh tokens with expiry
class TokenSet extends Equatable {
  const TokenSet({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiry,
    this.refreshTokenExpiry,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiry;
  final DateTime? refreshTokenExpiry;

  /// Create from JSON response
  factory TokenSet.fromJson(Map<String, dynamic> json) {
    return TokenSet(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      accessTokenExpiry: DateTime.parse(json['access_token_expiry'] as String),
      refreshTokenExpiry: json['refresh_token_expiry'] != null
          ? DateTime.parse(json['refresh_token_expiry'] as String)
          : null,
    );
  }

  /// Create with default expiry times (7 days for refresh, 15 min for access)
  factory TokenSet.withDefaults({
    required String accessToken,
    required String refreshToken,
    Duration accessTokenDuration = const Duration(minutes: 15),
    Duration refreshTokenDuration = const Duration(days: 7),
  }) {
    final now = DateTime.now();
    return TokenSet(
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiry: now.add(accessTokenDuration),
      refreshTokenExpiry: now.add(refreshTokenDuration),
    );
  }

  /// Check if access token is expired
  bool get isAccessTokenExpired {
    return DateTime.now().isAfter(accessTokenExpiry);
  }

  /// Check if refresh token is expired
  bool get isRefreshTokenExpired {
    if (refreshTokenExpiry == null) return false;
    return DateTime.now().isAfter(refreshTokenExpiry!);
  }

  /// Check if token set is valid (both tokens not expired)
  bool get isValid {
    return !isAccessTokenExpired && !isRefreshTokenExpired;
  }

  /// Check if access token should be refreshed (within buffer time)
  bool get shouldRefreshAccessToken {
    final bufferTime = accessTokenExpiry.subtract(
      const Duration(minutes: 5),
    );
    return DateTime.now().isAfter(bufferTime);
  }

  /// Get remaining validity duration
  Duration get remainingValidity {
    final timeLeft = accessTokenExpiry.difference(DateTime.now());
    return timeLeft.isNegative ? Duration.zero : timeLeft;
  }

  /// Get remaining validity as percentage (for progress indicators)
  double get validityPercentage {
    final totalDuration = accessTokenExpiry.difference(
      DateTime.now().subtract(const Duration(minutes: 15)),
    );
    final remaining = remainingValidity;
    if (totalDuration.inSeconds == 0) return 0;
    return (remaining.inSeconds / totalDuration.inSeconds).clamp(0.0, 1.0);
  }

  /// Convert to JSON for storage
  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'access_token_expiry': accessTokenExpiry.toIso8601String(),
      'refresh_token_expiry': refreshTokenExpiry?.toIso8601String(),
    };
  }

  /// Create a copy with updated fields
  TokenSet copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) {
    return TokenSet(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      accessTokenExpiry: accessTokenExpiry ?? this.accessTokenExpiry,
      refreshTokenExpiry: refreshTokenExpiry ?? this.refreshTokenExpiry,
    );
  }

  @override
  List<Object?> get props => [
        accessToken,
        refreshToken,
        accessTokenExpiry,
        refreshTokenExpiry,
      ];

  @override
  String toString() {
    return 'TokenSet('
        'accessToken: ${accessToken.substring(0, 10)}..., '
        'accessTokenExpiry: $accessTokenExpiry, '
        'refreshTokenExpiry: $refreshTokenExpiry)';
  }
}
