import 'package:hive_ce/hive.dart';
import '../models/product_model.dart';
import '../models/category_model.dart';

abstract class ProductLocalDataSource {
  Future<List<ProductModel>> getCachedProducts();
  Future<void> cacheProducts(List<ProductModel> products);
  Future<ProductModel?> getCachedProduct(String id);
  Future<void> cacheProduct(ProductModel product);
  Future<List<CategoryModel>> getCachedCategories();
  Future<void> cacheCategories(List<CategoryModel> categories);
  Future<void> clearCache();
  Future<bool> isCacheValid();
}

class ProductLocalDataSourceImpl implements ProductLocalDataSource {
  static const String productsBoxName = 'products_cache';
  static const String categoriesBoxName = 'categories_cache';
  static const String metadataBoxName = 'cache_metadata';
  static const String lastFetchKey = 'last_fetch';
  static const Duration cacheValidity = Duration(minutes: 30);

  Box<ProductModel>? _productsBox;
  Box<CategoryModel>? _categoriesBox;
  Box<dynamic>? _metadataBox;

  Future<Box<ProductModel>> get productsBox async {
    _productsBox ??= await Hive.openBox<ProductModel>(productsBoxName);
    return _productsBox!;
  }

  Future<Box<CategoryModel>> get categoriesBox async {
    _categoriesBox ??= await Hive.openBox<CategoryModel>(categoriesBoxName);
    return _categoriesBox!;
  }

  Future<Box<dynamic>> get metadataBox async {
    _metadataBox ??= await Hive.openBox<dynamic>(metadataBoxName);
    return _metadataBox!;
  }

  @override
  Future<List<ProductModel>> getCachedProducts() async {
    final box = await productsBox;
    return box.values.toList();
  }

  @override
  Future<void> cacheProducts(List<ProductModel> products) async {
    final box = await productsBox;
    final metadata = await metadataBox;

    await box.clear();
    for (final product in products) {
      await box.put(product.id, product);
    }
    await metadata.put(lastFetchKey, DateTime.now().toIso8601String());
  }

  @override
  Future<ProductModel?> getCachedProduct(String id) async {
    final box = await productsBox;
    return box.get(id);
  }

  @override
  Future<void> cacheProduct(ProductModel product) async {
    final box = await productsBox;
    await box.put(product.id, product);
  }

  @override
  Future<List<CategoryModel>> getCachedCategories() async {
    final box = await categoriesBox;
    return box.values.toList();
  }

  @override
  Future<void> cacheCategories(List<CategoryModel> categories) async {
    final box = await categoriesBox;
    await box.clear();
    for (final category in categories) {
      await box.put(category.id, category);
    }
  }

  @override
  Future<void> clearCache() async {
    final products = await productsBox;
    final categories = await categoriesBox;
    final metadata = await metadataBox;

    await products.clear();
    await categories.clear();
    await metadata.clear();
  }

  @override
  Future<bool> isCacheValid() async {
    final metadata = await metadataBox;
    final lastFetchStr = metadata.get(lastFetchKey) as String?;

    if (lastFetchStr == null) return false;

    final lastFetch = DateTime.tryParse(lastFetchStr);
    if (lastFetch == null) return false;

    return DateTime.now().difference(lastFetch) < cacheValidity;
  }
}
