import '../../data/models/product_model.dart';
import '../../data/models/category_model.dart';
import '../models/product_catalog_query.dart';

abstract class ProductRepository {
  Future<List<ProductModel>> getProducts({
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? searchQuery,
    ProductCatalogFilters filters = const ProductCatalogFilters(),
    ProductSort sort = ProductSort.newest,
    bool forceRefresh = false,
  });
  Future<ProductModel> getProductById(String id);
  Future<List<CategoryModel>> getCategories({bool forceRefresh = false});
  Future<CategoryModel> getCategoryById(String id);
  Future<List<ProductModel>> getFeaturedProducts({bool forceRefresh = false});
  Future<List<ProductModel>> searchProducts(String query);
  Future<void> clearCache();
}
