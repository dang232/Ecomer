import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';

part 'category_model.g.dart';

@HiveType(typeId: 1)
class CategoryModel extends Equatable {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String name;

  @HiveField(2)
  final String? description;

  @HiveField(3)
  final String iconUrl;

  @HiveField(4)
  final String? parentId;

  @HiveField(5)
  final int sortOrder;

  @HiveField(6)
  final bool isActive;

  @HiveField(7)
  final int productCount;

  const CategoryModel({
    required this.id,
    required this.name,
    this.description,
    this.iconUrl = '',
    this.parentId,
    this.sortOrder = 0,
    this.isActive = true,
    this.productCount = 0,
  });

  bool get isParent => parentId == null || parentId!.isEmpty;

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString(),
      iconUrl: json['iconUrl']?.toString() ?? json['icon_url']?.toString() ?? '',
      parentId: json['parentId']?.toString() ?? json['parent_id']?.toString(),
      sortOrder: json['sortOrder'] is int
          ? json['sortOrder'] as int
          : int.tryParse(json['sortOrder']?.toString() ?? '0') ?? 0,
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
      productCount: json['productCount'] is int
          ? json['productCount'] as int
          : int.tryParse(json['productCount']?.toString() ?? '0') ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'iconUrl': iconUrl,
      'parentId': parentId,
      'sortOrder': sortOrder,
      'isActive': isActive,
      'productCount': productCount,
    };
  }

  CategoryModel copyWith({
    String? id,
    String? name,
    String? description,
    String? iconUrl,
    String? parentId,
    int? sortOrder,
    bool? isActive,
    int? productCount,
  }) {
    return CategoryModel(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      iconUrl: iconUrl ?? this.iconUrl,
      parentId: parentId ?? this.parentId,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
      productCount: productCount ?? this.productCount,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        iconUrl,
        parentId,
        sortOrder,
        isActive,
        productCount,
      ];
}
