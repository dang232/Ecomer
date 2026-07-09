import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';
import 'package:vnshop_mobile/core/utils/validators.dart';

part 'product_model.g.dart';

@HiveType(typeId: 0)
class ProductModel extends Equatable {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String name;

  @HiveField(2)
  final String description;

  @HiveField(3)
  final double price;

  @HiveField(4)
  final double? originalPrice;

  @HiveField(5)
  final String imageUrl;

  @HiveField(6)
  final List<String> images;

  @HiveField(7)
  final int stock;

  @HiveField(8)
  final String categoryId;

  @HiveField(9)
  final String categoryName;

  @HiveField(10)
  final double rating;

  @HiveField(11)
  final int reviewCount;

  @HiveField(12)
  final bool isFeatured;

  @HiveField(13)
  final bool isActive;

  @HiveField(14)
  final DateTime createdAt;

  @HiveField(15)
  final DateTime updatedAt;

  const ProductModel({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.originalPrice,
    required this.imageUrl,
    this.images = const [],
    required this.stock,
    required this.categoryId,
    required this.categoryName,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.isFeatured = false,
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
  });

  double? get discountPercentage {
    if (originalPrice == null || originalPrice! <= price) return null;
    return ((originalPrice! - price) / originalPrice! * 100);
  }

  bool get hasDiscount => discountPercentage != null;

  /// Parse from real backend API response
  /// Backend returns: { success, data: { content: [...] } }
  factory ProductModel.fromBackendJson(Map<String, dynamic> json) {
    // Extract from nested data.content structure
    final data = json['data'];
    if (data is Map) {
      final content = data['content'] ?? data['data'] ?? data;
      return _parseProductFromData(content);
    }
    return _parseProductFromData(data ?? json);
  }

  static ProductModel _parseProductFromData(Map<String, dynamic> json) {
    // Handle nested variants structure from real backend
    String imageUrl = '';
    double price = 0;
    
    if (json['variants'] != null && (json['variants'] as List).isNotEmpty) {
      final variant = json['variants'][0];
      imageUrl = variant['imageUrl']?.toString() ?? '';
      price = _parseDouble(variant['priceAmount'] ?? variant['price']);
    }
    
    // Fallback to direct fields if no variants
    imageUrl = imageUrl.isEmpty ? (json['imageUrl']?.toString() ?? json['image_url']?.toString() ?? '') : imageUrl;
    price = price == 0 ? _parseDouble(json['price'] ?? json['priceAmount']) : price;

    // Sanitize image URLs to fix issues like "..png" double dots
    imageUrl = Validators.sanitizeImageUrl(imageUrl) ?? '';

    // Parse images array
    List<String> images = [];
    if (json['images'] != null) {
      images = (json['images'] as List).map((img) {
        if (img is Map) {
          return Validators.sanitizeImageUrl(img['url']?.toString()) ?? '';
        }
        return Validators.sanitizeImageUrl(img.toString()) ?? '';
      }).where((url) => url.isNotEmpty).toList();
    }

    // Parse original price
    double? originalPrice;
    if (json['originalPrice'] != null || json['original_price'] != null) {
      originalPrice = _parseDouble(json['originalPrice'] ?? json['original_price']);
    }

    return ProductModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      price: price,
      originalPrice: originalPrice,
      imageUrl: imageUrl,
      images: images,
      stock: _parseInt(json['stock'] ?? json['stockQuantity'] ?? json['variants']?[0]?['stockQuantity']),
      categoryId: json['categoryId']?.toString() ?? json['category_id']?.toString() ?? '',
      categoryName: json['categoryName']?.toString() ?? json['category_name']?.toString() ?? '',
      rating: _parseDouble(json['rating'] ?? 0),
      reviewCount: _parseInt(json['reviewCount'] ?? json['review_count'] ?? 0),
      isFeatured: json['isFeatured'] == true || json['is_featured'] == true || json['featured'] == true,
      isActive: json['isActive'] != false && json['is_active'] != false && json['status'] != 'DRAFT',
      createdAt: _parseDateTime(json['createdAt'] ?? json['created_at']),
      updatedAt: _parseDateTime(json['updatedAt'] ?? json['updated_at']),
    );
  }

  static double _parseDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static DateTime _parseDateTime(dynamic value) {
    if (value == null) return DateTime.now();
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
    return DateTime.now();
  }

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return _parseProductFromData(json);
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'originalPrice': originalPrice,
      'imageUrl': imageUrl,
      'images': images,
      'stock': stock,
      'categoryId': categoryId,
      'categoryName': categoryName,
      'rating': rating,
      'reviewCount': reviewCount,
      'isFeatured': isFeatured,
      'isActive': isActive,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  ProductModel copyWith({
    String? id,
    String? name,
    String? description,
    double? price,
    double? originalPrice,
    String? imageUrl,
    List<String>? images,
    int? stock,
    String? categoryId,
    String? categoryName,
    double? rating,
    int? reviewCount,
    bool? isFeatured,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ProductModel(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      price: price ?? this.price,
      originalPrice: originalPrice ?? this.originalPrice,
      imageUrl: imageUrl ?? this.imageUrl,
      images: images ?? this.images,
      stock: stock ?? this.stock,
      categoryId: categoryId ?? this.categoryId,
      categoryName: categoryName ?? this.categoryName,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      isFeatured: isFeatured ?? this.isFeatured,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        price,
        originalPrice,
        imageUrl,
        images,
        stock,
        categoryId,
        categoryName,
        rating,
        reviewCount,
        isFeatured,
        isActive,
        createdAt,
        updatedAt,
      ];
}
