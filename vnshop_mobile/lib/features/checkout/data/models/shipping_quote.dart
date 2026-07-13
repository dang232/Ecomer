import 'package:equatable/equatable.dart';

enum ShippingProvider {
  giaoHangNhanh,
  giaoHangTietKiem,
  viettelPost,
  vnPost,
  jAndTExpress,
}

class ShippingQuote extends Equatable {
  final String id;
  final String name;
  final String description;
  final double price;
  final double cost;
  final int estimatedDays;
  final String? estimatedDeliveryDate;
  final String? estimate;
  final ShippingProvider provider;
  final String? method;
  final bool isAvailable;
  final String? logoUrl;

  const ShippingQuote({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.cost = 0.0,
    required this.estimatedDays,
    this.estimatedDeliveryDate,
    this.estimate,
    required this.provider,
    this.method,
    this.isAvailable = true,
    this.logoUrl,
  });

  String get providerLabel {
    switch (provider) {
      case ShippingProvider.giaoHangNhanh:
        return 'Giao Hàng Nhanh';
      case ShippingProvider.giaoHangTietKiem:
        return 'Giao Hàng Tiết Kiệm';
      case ShippingProvider.viettelPost:
        return 'Viettel Post';
      case ShippingProvider.vnPost:
        return 'VNPost';
      case ShippingProvider.jAndTExpress:
        return 'J&T Express';
    }
  }

  String get estimatedTime {
    if (estimatedDays == 1) {
      return 'Giao trong ngày';
    }
    return '$estimatedDays ngày';
  }

  ShippingQuote copyWith({
    String? id,
    String? name,
    String? description,
    double? price,
    double? cost,
    int? estimatedDays,
    String? estimatedDeliveryDate,
    String? estimate,
    ShippingProvider? provider,
    String? method,
    bool? isAvailable,
    String? logoUrl,
  }) {
    return ShippingQuote(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      price: price ?? this.price,
      cost: cost ?? this.cost,
      estimatedDays: estimatedDays ?? this.estimatedDays,
      estimatedDeliveryDate:
          estimatedDeliveryDate ?? this.estimatedDeliveryDate,
      estimate: estimate ?? this.estimate,
      provider: provider ?? this.provider,
      method: method ?? this.method,
      isAvailable: isAvailable ?? this.isAvailable,
      logoUrl: logoUrl ?? this.logoUrl,
    );
  }

  factory ShippingQuote.fromJson(Map<String, dynamic> json) {
    // Backend sends: { method, cost, estimate }
    // Also support legacy fields: { name, price, estimatedDays, provider }
    final method = json['method'] as String?;
    final cost = (json['cost'] as num?)?.toDouble() ?? 0.0;
    final estimate = json['estimate'] as String?;

    return ShippingQuote(
      id: json['id'] as String? ?? method ?? '',
      name: json['name'] as String? ?? method ?? '',
      description: json['description'] as String? ?? estimate ?? '',
      price: (json['price'] as num?)?.toDouble() ?? cost,
      cost: cost,
      estimatedDays: json['estimatedDays'] as int? ??
          json['estimated_days'] as int? ??
          _parseEstimateToDays(estimate),
      estimatedDeliveryDate: json['estimatedDeliveryDate'] as String? ??
          json['estimated_delivery_date'] as String?,
      estimate: estimate,
      provider: _parseProvider(json['provider'] as String?),
      method: method,
      isAvailable: json['isAvailable'] as bool? ?? true,
      logoUrl: json['logoUrl'] as String? ?? json['logo_url'] as String?,
    );
  }

  static int _parseEstimateToDays(String? estimate) {
    if (estimate == null) return 0;
    final match = RegExp(r'(\d+)').firstMatch(estimate);
    return match != null ? int.tryParse(match.group(1)!) ?? 0 : 0;
  }

  static ShippingProvider _parseProvider(String? provider) {
    switch (provider?.toLowerCase()) {
      case 'ghn':
      case 'giaohangnhanh':
        return ShippingProvider.giaoHangNhanh;
      case 'ghtk':
      case 'giaohangtietkiem':
        return ShippingProvider.giaoHangTietKiem;
      case 'viettel':
      case 'viettelpost':
        return ShippingProvider.viettelPost;
      case 'vnpost':
      case 'post':
        return ShippingProvider.vnPost;
      case 'jt':
      case 'jnt':
      case 'j&t':
        return ShippingProvider.jAndTExpress;
      default:
        return ShippingProvider.giaoHangNhanh;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'cost': cost,
      'estimatedDays': estimatedDays,
      'estimatedDeliveryDate': estimatedDeliveryDate,
      'estimate': estimate,
      'provider': provider.name,
      'method': method,
      'isAvailable': isAvailable,
      'logoUrl': logoUrl,
    };
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        price,
        cost,
        estimatedDays,
        estimatedDeliveryDate,
        estimate,
        provider,
        method,
        isAvailable,
        logoUrl,
      ];
}
