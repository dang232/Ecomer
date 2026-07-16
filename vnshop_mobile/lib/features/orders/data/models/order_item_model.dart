import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';

part 'order_item_model.g.dart';

@HiveType(typeId: 3)
class OrderItemModel extends Equatable {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String productId;

  @HiveField(2)
  final String productName;

  @HiveField(3)
  final String productImage;

  @HiveField(4)
  final double price;

  @HiveField(5)
  final int quantity;

  @HiveField(6)
  final double totalPrice;

  final String? variantSku;
  final String? sellerId;

  const OrderItemModel({
    required this.id,
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.price,
    required this.quantity,
    required this.totalPrice,
    this.variantSku,
    this.sellerId,
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    final productId = _string(json['productId'] ?? json['product_id']);
    final variantSku = _nullableString(
      json['variantSku'] ?? json['variant_sku'],
    );
    final sellerId = _nullableString(json['sellerId'] ?? json['seller_id']);
    final quantity = _integer(json['quantity'], fallback: 1);
    final price = _moneyAmount(
      json['unitPrice'] ?? json['unit_price'] ?? json['price'],
    );

    return OrderItemModel(
      id:
          _nullableString(json['id']) ??
          [
            productId,
            variantSku,
            sellerId,
          ].whereType<String>().where((value) => value.isNotEmpty).join(':'),
      productId: productId,
      productName: _string(
        json['name'] ?? json['productName'] ?? json['product_name'],
      ),
      productImage: _string(
        json['imageUrl'] ?? json['productImage'] ?? json['product_image'],
      ),
      price: price,
      quantity: quantity,
      totalPrice: _moneyAmount(
        json['totalPrice'] ?? json['total_price'],
        fallback: price * quantity,
      ),
      variantSku: variantSku,
      sellerId: sellerId,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'product_id': productId,
      'product_name': productName,
      'product_image': productImage,
      'price': price,
      'quantity': quantity,
      'total_price': totalPrice,
      'variant_sku': variantSku,
      'seller_id': sellerId,
    };
  }

  @override
  List<Object?> get props => [
    id,
    productId,
    productName,
    productImage,
    price,
    quantity,
    totalPrice,
    variantSku,
    sellerId,
  ];
}

double _moneyAmount(Object? value, {double fallback = 0}) {
  final raw = value is Map ? value['amount'] : value;
  if (raw is num) return raw.toDouble();
  return double.tryParse(raw?.toString() ?? '') ?? fallback;
}

int _integer(Object? value, {required int fallback}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

String _string(Object? value) => value?.toString() ?? '';

String? _nullableString(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}
