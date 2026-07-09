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
  final int estimatedDays;
  final String? estimatedDeliveryDate;
  final ShippingProvider provider;
  final bool isAvailable;
  final String? logoUrl;

  const ShippingQuote({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.estimatedDays,
    this.estimatedDeliveryDate,
    required this.provider,
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
    int? estimatedDays,
    String? estimatedDeliveryDate,
    ShippingProvider? provider,
    bool? isAvailable,
    String? logoUrl,
  }) {
    return ShippingQuote(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      price: price ?? this.price,
      estimatedDays: estimatedDays ?? this.estimatedDays,
      estimatedDeliveryDate:
          estimatedDeliveryDate ?? this.estimatedDeliveryDate,
      provider: provider ?? this.provider,
      isAvailable: isAvailable ?? this.isAvailable,
      logoUrl: logoUrl ?? this.logoUrl,
    );
  }

  factory ShippingQuote.fromJson(Map<String, dynamic> json) {
    return ShippingQuote(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      estimatedDays: json['estimatedDays'] as int? ??
          json['estimated_days'] as int? ??
          0,
      estimatedDeliveryDate: json['estimatedDeliveryDate'] as String? ??
          json['estimated_delivery_date'] as String?,
      provider: _parseProvider(json['provider'] as String?),
      isAvailable: json['isAvailable'] as bool? ?? true,
      logoUrl: json['logoUrl'] as String? ?? json['logo_url'] as String?,
    );
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
      'estimatedDays': estimatedDays,
      'estimatedDeliveryDate': estimatedDeliveryDate,
      'provider': provider.name,
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
        estimatedDays,
        estimatedDeliveryDate,
        provider,
        isAvailable,
        logoUrl,
      ];
}
