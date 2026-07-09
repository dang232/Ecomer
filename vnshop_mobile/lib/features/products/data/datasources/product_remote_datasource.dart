import 'package:dio/dio.dart';
import 'package:vnshop_mobile/core/config/env_config.dart';
import '../models/product_model.dart';
import '../models/category_model.dart';

abstract class ProductRemoteDataSource {
  Future<List<ProductModel>> getProducts({
    int page = 1,
    int limit = 20,
    String? categoryId,
    String? searchQuery,
  });
  Future<ProductModel> getProductById(String id);
  Future<List<CategoryModel>> getCategories();
  Future<List<ProductModel>> getFeaturedProducts();
  Future<List<ProductModel>> searchProducts(String query);
  Future<CategoryModel> getCategoryById(String id);
}

class ProductRemoteDataSourceImpl implements ProductRemoteDataSource {
  final Dio dio;
  late final String baseUrl;

  ProductRemoteDataSourceImpl({required this.dio}) {
    baseUrl = '${EnvConfig.apiBaseUrl}/products';
  }

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
      return data.map((item) => CategoryModel.fromJson(item as Map<String, dynamic>)).toList();
    }

    if (data is Map<String, dynamic>) {
      // Handle { success, data: { content: [...] } }
      if (data.containsKey('data')) {
        final inner = data['data'];
        if (inner is Map<String, dynamic> && inner.containsKey('content')) {
          return (inner['content'] as List)
              .map((item) => CategoryModel.fromJson(item as Map<String, dynamic>))
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
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'size': limit,
      };

      if (categoryId != null && categoryId.isNotEmpty) {
        queryParams['categoryId'] = categoryId;
      }

      if (searchQuery != null && searchQuery.isNotEmpty) {
        queryParams['search'] = searchQuery;
      }

      final response = await dio.get(
        baseUrl,
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
        return ProductModel.fromJson(response.data);
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
    try {
      final response = await dio.get(
        baseUrl,
        queryParameters: {'search': query, 'size': 20},
      );

      if (response.statusCode == 200) {
        return _parseProducts(response.data);
      }

      return [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
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
