import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';
import 'package:vnshop_mobile/core/utils/validators.dart';

part 'cart_item_model.g.dart';

@HiveType(typeId: 0)
class CartItemModel extends Equatable {
  @HiveField(0)
  final String cartItemId;

  @HiveField(1)
  final String productId;

  @HiveField(2)
  final String name;

  @HiveField(3)
  final String? imageUrl;

  @HiveField(4)
  final double price;

  @HiveField(5)
  final int quantity;

  @HiveField(6)
  final String? sku;

  @HiveField(7)
  final String? optionName;

  const CartItemModel({
    required this.cartItemId,
    required this.productId,
    required this.name,
    this.imageUrl,
    required this.price,
    required this.quantity,
    this.sku,
    this.optionName,
  });

  double get totalPrice => price * quantity;

  CartItemModel copyWith({
    String? cartItemId,
    String? productId,
    String? name,
    String? imageUrl,
    double? price,
    int? quantity,
    String? sku,
    String? optionName,
  }) {
    return CartItemModel(
      cartItemId: cartItemId ?? this.cartItemId,
      productId: productId ?? this.productId,
      name: name ?? this.name,
      imageUrl: imageUrl ?? this.imageUrl,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      sku: sku ?? this.sku,
      optionName: optionName ?? this.optionName,
    );
  }

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    final productId = json['productId'] as String? ??
        json['product_id'] as String? ??
        '';
    final variantId = json['variantId'] as String? ??
        json['variant_id'] as String? ??
        json['sku'] as String?;
    final unitPrice = json['unitPrice'];
    final price = json['price'] as num? ??
        (unitPrice is Map ? unitPrice['amount'] as num? : null);

    return CartItemModel(
      cartItemId: json['cartItemId'] as String? ??
          json['cart_item_id'] as String? ??
          (variantId == null ? productId : '$productId:$variantId'),
      productId: productId,
      name: json['name'] as String? ??
          json['productName'] as String? ??
          '',
      imageUrl: Validators.sanitizeImageUrl(
        json['imageUrl'] as String? ??
            json['image_url'] as String? ??
            json['productImage'] as String?,
      ),
      price: price?.toDouble() ?? 0.0,
      quantity: json['quantity'] as int? ?? 1,
      sku: variantId,
      optionName: json['optionName'] as String? ?? json['option_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'cartItemId': cartItemId,
      'productId': productId,
      'name': name,
      'imageUrl': imageUrl,
      'price': price,
      'quantity': quantity,
      'sku': sku,
      'optionName': optionName,
    };
  }

  @override
  List<Object?> get props => [
        cartItemId,
        productId,
        name,
        imageUrl,
        price,
        quantity,
        sku,
        optionName,
      ];
}
