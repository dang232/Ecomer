import 'package:dio/dio.dart';
import 'package:vnshop_mobile/core/config/env_config.dart';
import '../../domain/models/product_catalog_query.dart';
import '../models/product_model.dart';
import '../models/category_model.dart';

abstract class ProductRemoteDataSource {
  Future<List<ProductModel>> getProducts({
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? searchQuery,
    ProductCatalogFilters filters = const ProductCatalogFilters(),
    ProductSort sort = ProductSort.newest,
  });
  Future<ProductModel> getProductById(String id);
  Future<List<CategoryModel>> getCategories();
  Future<List<ProductModel>> getFeaturedProducts();
  Future<List<ProductModel>> searchProducts(String query);
  Future<CategoryModel> getCategoryById(String id);
}

class ProductRemoteDataSourceImpl implements ProductRemoteDataSource {
  final Dio dio;
  final String baseUrl;
  final String searchBaseUrl;

  ProductRemoteDataSourceImpl({
    required this.dio,
    String? baseUrl,
    String? searchBaseUrl,
  }) : baseUrl = baseUrl ?? '${EnvConfig.apiBaseUrl}/products',
       searchBaseUrl =
           searchBaseUrl ??
           (baseUrl?.endsWith('/products') == true
               ? '${baseUrl!.substring(0, baseUrl.length - '/products'.length)}/search'
               : '${EnvConfig.apiBaseUrl}/search');

  List<ProductModel> _parseProducts(dynamic data) {
    if (data == null) return [];

    // Backend wraps in { success, data: { content: [...] } }
    if (data is Map<String, dynamic>) {
      // Check for nested content array
      if (data.containsKey('data')) {
        final inner = data['data'];
        if (inner is Map<String, dynamic>) {
          if (inner.containsKey('content')) {
            return _parseProductList(inner['content']);
          }
          if (inner.containsKey('data')) {
            return _parseProductList(inner['data']);
          }
        }
        return _parseProductList(inner);
      }

      // Direct content array
      if (data.containsKey('content')) {
        return _parseProductList(data['content']);
      }

      // Fallback: try to parse as direct product
      if (data.containsKey('id')) {
        return [ProductModel.fromJson(data)];
      }
    }

    // Direct list
    if (data is List) {
      return _parseProductList(data);
    }

    return [];
  }

  List<ProductModel> _parseProductList(dynamic list) {
    if (list == null) return [];
    if (list is! List) return [];

    return list
        .whereType<Map<String, dynamic>>()
        .map((item) => ProductModel.fromJson(item))
        .toList();
  }

  List<CategoryModel> _parseCategories(dynamic data) {
    if (data == null) return [];

    if (data is List) {
      return data
          .map((item) => CategoryModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    if (data is Map<String, dynamic>) {
      // Handle { success, data: { content: [...] } }
      if (data.containsKey('data')) {
        final inner = data['data'];
        if (inner is Map<String, dynamic> && inner.containsKey('content')) {
          return (inner['content'] as List)
              .map(
                (item) => CategoryModel.fromJson(item as Map<String, dynamic>),
              )
              .toList();
        }
      }

      if (data.containsKey('content')) {
        return (data['content'] as List)
            .map((item) => CategoryModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }

      if (data.containsKey('categories')) {
        return (data['categories'] as List)
            .map((item) => CategoryModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    }

    return [];
  }

  @override
  Future<List<ProductModel>> getProducts({
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? searchQuery,
    ProductCatalogFilters filters = const ProductCatalogFilters(),
    ProductSort sort = ProductSort.newest,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page > 0 ? page - 1 : 0,
        'size': limit,
        'sort': sort.apiValue,
      };

      final normalizedCategory = categoryId?.trim();
      if (normalizedCategory != null && normalizedCategory.isNotEmpty) {
        queryParams['category'] = normalizedCategory;
      }

      final normalizedSearch = searchQuery?.trim();
      if (normalizedSearch != null && normalizedSearch.isNotEmpty) {
        queryParams['q'] = normalizedSearch;
      }

      if (filters.minPrice != null) {
        queryParams['minPrice'] = filters.minPrice;
      }
      if (filters.maxPrice != null) {
        queryParams['maxPrice'] = filters.maxPrice;
      }
      if (filters.sameDayOnly) queryParams['sameDay'] = true;
      if (filters.verifiedOnly) queryParams['verifiedOnly'] = true;
      if (filters.officialOnly) queryParams['officialOnly'] = true;

      final response = await dio.get(
        searchBaseUrl,
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        return _parseProducts(response.data);
      }

      return [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  @override
  Future<ProductModel> getProductById(String id) async {
    try {
      final response = await dio.get('$baseUrl/$id');

      if (response.statusCode == 200) {
        return ProductModel.fromBackendJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      }

      throw Exception('Không tìm thấy sản phẩm');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  @override
  Future<List<CategoryModel>> getCategories() async {
    try {
      final response = await dio.get('${EnvConfig.apiBaseUrl}/categories');

      if (response.statusCode == 200) {
        return _parseCategories(response.data);
      }

      return [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  @override
  Future<CategoryModel> getCategoryById(String id) async {
    try {
      final response = await dio.get('${EnvConfig.apiBaseUrl}/categories/$id');

      if (response.statusCode == 200) {
        return CategoryModel.fromJson(response.data);
      }

      throw Exception('Không tìm thấy danh mục');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  @override
  Future<List<ProductModel>> getFeaturedProducts() async {
    try {
      // Use the search endpoint for featured or just get all products
      final response = await dio.get(
        baseUrl,
        queryParameters: {'featured': true, 'size': 10},
      );

      if (response.statusCode == 200) {
        final products = _parseProducts(response.data);
        // If no featured filter works, return first 10 products
        return products.isEmpty ? products.take(10).toList() : products;
      }

      return [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  @override
  Future<List<ProductModel>> searchProducts(String query) async {
    return getProducts(searchQuery: query);
  }

  Exception _handleError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('Hết thời gian kết nối. Vui lòng thử lại.');
      case DioExceptionType.connectionError:
        return Exception('Không có kết nối mạng. Vui lòng kiểm tra internet.');
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        if (statusCode == 404) {
          return Exception('Không tìm thấy dữ liệu.');
        } else if (statusCode == 500) {
          return Exception('Lỗi máy chủ. Vui lòng thử lại sau.');
        }
        return Exception('Yêu cầu không thành công: $statusCode');
      default:
        return Exception('Đã xảy ra lỗi: ${e.message}');
    }
  }
}
