import '../../domain/repositories/wishlist_repository.dart';
import '../datasources/wishlist_remote_data_source.dart';

class WishlistRepositoryImpl implements WishlistRepository {
  WishlistRepositoryImpl({required this.remoteDataSource});

  final WishlistRemoteDataSource remoteDataSource;

  @override
  Future<List<String>> getProductIds() => remoteDataSource.getProductIds();

  @override
  Future<bool> toggle(String productId) => remoteDataSource.toggle(productId);
}
