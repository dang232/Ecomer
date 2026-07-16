import 'package:dio/dio.dart';

enum OrderFailure {
  network,
  unauthorized,
  forbidden,
  notFound,
  server,
  requestCancelled,
  unknown,
}

OrderFailure mapOrderFailure(Object error) {
  if (error is! DioException) return OrderFailure.unknown;
  return switch (error.type) {
    DioExceptionType.connectionTimeout ||
    DioExceptionType.sendTimeout ||
    DioExceptionType.receiveTimeout ||
    DioExceptionType.connectionError => OrderFailure.network,
    DioExceptionType.cancel => OrderFailure.requestCancelled,
    DioExceptionType.badResponse => switch (error.response?.statusCode) {
      401 => OrderFailure.unauthorized,
      403 => OrderFailure.forbidden,
      404 => OrderFailure.notFound,
      int code when code >= 500 => OrderFailure.server,
      _ => OrderFailure.unknown,
    },
    _ => OrderFailure.unknown,
  };
}
