import '../../domain/repositories/product_repository.dart';
import '../datasources/product_local_datasource.dart';
import '../datasources/product_remote_datasource.dart';
import '../models/product_model.dart';
import '../models/category_model.dart';
import '../../domain/models/product_catalog_query.dart';

class ProductRepositoryImpl implements ProductRepository {
  final ProductRemoteDataSource remoteDataSource;
  final ProductLocalDataSource localDataSource;

  ProductRepositoryImpl({
    required this.remoteDataSource,
    required this.localDataSource,
  });

  @override
  Future<List<ProductModel>> getProducts({
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? searchQuery,
    ProductCatalogFilters filters = const ProductCatalogFilters(),
    ProductSort sort = ProductSort.newest,
    bool forceRefresh = false,
  }) async {
    try {
      final canUseUnfilteredCache =
          !forceRefresh &&
          page == 1 &&
          (categoryId == null || categoryId.isEmpty) &&
          (searchQuery == null || searchQuery.isEmpty) &&
          !filters.hasActiveFilters &&
          sort == ProductSort.newest;
      if (canUseUnfilteredCache && await localDataSource.isCacheValid()) {
        final cachedProducts = await localDataSource.getCachedProducts();

        if (cachedProducts.isNotEmpty) {
          return cachedProducts;
        }
      }

      final products = await remoteDataSource.getProducts(
        page: page,
        limit: limit,
        categoryId: categoryId,
        searchQuery: searchQuery,
        filters: filters,
        sort: sort,
      );

      if (canUseUnfilteredCache) {
        await localDataSource.cacheProducts(products);
      }

      return products;
    } catch (e) {
      if (page == 1 &&
          (categoryId == null || categoryId.isEmpty) &&
          (searchQuery == null || searchQuery.isEmpty) &&
          !filters.hasActiveFilters &&
          sort == ProductSort.newest) {
        final cachedProducts = await localDataSource.getCachedProducts();
        if (cachedProducts.isNotEmpty) {
          return cachedProducts;
        }
      }
      rethrow;
    }
  }

  @override
  Future<ProductModel> getProductById(String id) async {
    try {
      final product = await remoteDataSource.getProductById(id);
      await localDataSource.cacheProduct(product);
      return product;
    } catch (e) {
      final cachedProduct = await localDataSource.getCachedProduct(id);
      if (cachedProduct != null) {
        return cachedProduct;
      }
      rethrow;
    }
  }

  @override
  Future<List<CategoryModel>> getCategories({bool forceRefresh = false}) async {
    try {
      if (!forceRefresh) {
        final cachedCategories = await localDataSource.getCachedCategories();
        if (cachedCategories.isNotEmpty) {
          return cachedCategories;
        }
      }

      final categories = await remoteDataSource.getCategories();
      await localDataSource.cacheCategories(categories);
      return categories;
    } catch (e) {
      final cachedCategories = await localDataSource.getCachedCategories();
      if (cachedCategories.isNotEmpty) {
        return cachedCategories;
      }
      rethrow;
    }
  }

  @override
  Future<CategoryModel> getCategoryById(String id) async {
    return await remoteDataSource.getCategoryById(id);
  }

  @override
  Future<List<ProductModel>> getFeaturedProducts({
    bool forceRefresh = false,
  }) async {
    try {
      return await remoteDataSource.getFeaturedProducts();
    } catch (e) {
      final cachedProducts = await localDataSource.getCachedProducts();
      return cachedProducts.where((p) => p.isFeatured).toList();
    }
  }

  @override
  Future<List<ProductModel>> searchProducts(String query) async {
    try {
      return await remoteDataSource.searchProducts(query);
    } catch (e) {
      final cachedProducts = await localDataSource.getCachedProducts();
      final queryLower = query.toLowerCase();
      return cachedProducts
          .where(
            (p) =>
                p.name.toLowerCase().contains(queryLower) ||
                p.description.toLowerCase().contains(queryLower),
          )
          .toList();
    }
  }

  @override
  Future<void> clearCache() async {
    await localDataSource.clearCache();
  }
}
