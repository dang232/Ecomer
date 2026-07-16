abstract interface class WishlistRepository {
  Future<List<String>> getProductIds();

  Future<bool> toggle(String productId);
}
