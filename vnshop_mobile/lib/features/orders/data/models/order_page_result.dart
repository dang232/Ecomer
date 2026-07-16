import 'package:equatable/equatable.dart';

import 'order_model.dart';

class OrderPageResult extends Equatable {
  const OrderPageResult({
    required this.orders,
    required this.page,
    required this.pageSize,
    required this.totalElements,
    required this.totalPages,
    required this.hasNext,
  });

  factory OrderPageResult.fromJson(
    Map<String, dynamic> json, {
    required int requestedPage,
    required int requestedPageSize,
  }) {
    final content = json['content'];
    final orders = content is List
        ? content
              .whereType<Map>()
              .map(
                (item) => OrderModel.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList(growable: false)
        : const <OrderModel>[];
    final zeroBasedPage = _integer(json['number'], requestedPage - 1);
    final pageSize = _integer(json['size'], requestedPageSize);
    final totalElements = _integer(json['totalElements'], orders.length);
    final totalPages = _integer(
      json['totalPages'],
      pageSize == 0 ? 0 : (totalElements / pageSize).ceil(),
    );
    final last = json['last'];

    return OrderPageResult(
      orders: orders,
      page: zeroBasedPage + 1,
      pageSize: pageSize,
      totalElements: totalElements,
      totalPages: totalPages,
      hasNext: last is bool ? !last : zeroBasedPage + 1 < totalPages,
    );
  }

  factory OrderPageResult.singlePage(List<OrderModel> orders) {
    return OrderPageResult(
      orders: orders,
      page: 1,
      pageSize: orders.length,
      totalElements: orders.length,
      totalPages: orders.isEmpty ? 0 : 1,
      hasNext: false,
    );
  }

  final List<OrderModel> orders;
  final int page;
  final int pageSize;
  final int totalElements;
  final int totalPages;
  final bool hasNext;

  @override
  List<Object?> get props => [
    orders,
    page,
    pageSize,
    totalElements,
    totalPages,
    hasNext,
  ];
}

int _integer(Object? value, int fallback) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}
