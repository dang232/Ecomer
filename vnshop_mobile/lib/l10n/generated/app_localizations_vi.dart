// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get appTitle => 'VNShop';

  @override
  String get home => 'Trang chủ';

  @override
  String get products => 'Sản phẩm';

  @override
  String get browseProducts => 'Khám phá sản phẩm';

  @override
  String get allCategories => 'Tất cả';

  @override
  String productsFound(int count) {
    return '$count sản phẩm';
  }

  @override
  String get notifications => 'Thông báo';

  @override
  String get favorites => 'Yêu thích';

  @override
  String favoritesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sản phẩm đã lưu',
      one: '1 sản phẩm đã lưu',
    );
    return '$_temp0';
  }

  @override
  String get noFavoritesTitle => 'Chưa có sản phẩm yêu thích';

  @override
  String get noFavoritesSubtitle =>
      'Lưu sản phẩm để tìm lại nhanh chóng tại đây.';

  @override
  String get favoritesLoadError => 'Không thể tải sản phẩm yêu thích';

  @override
  String get favoritesLoadHelp => 'Kiểm tra kết nối rồi thử lại.';

  @override
  String get someFavoritesLoadError => 'Không thể tải một số sản phẩm đã lưu.';

  @override
  String get refresh => 'Làm mới';

  @override
  String get homeProductsLoadError => 'Không thể tải sản phẩm';

  @override
  String get homeProductsLoadHelp => 'Kiểm tra kết nối và thử lại.';

  @override
  String get noProductsTitle => 'Không tìm thấy sản phẩm';

  @override
  String get noProductsSubtitle => 'Hãy thử từ khóa hoặc danh mục khác.';

  @override
  String get filters => 'Bộ lọc';

  @override
  String get sortProducts => 'Sắp xếp sản phẩm';

  @override
  String get clearFilters => 'Xóa bộ lọc';

  @override
  String get resetFilters => 'Đặt lại';

  @override
  String get applyFilters => 'Áp dụng bộ lọc';

  @override
  String get minimumPrice => 'Giá tối thiểu';

  @override
  String get maximumPrice => 'Giá tối đa';

  @override
  String get invalidPrice => 'Nhập mức giá hợp lệ.';

  @override
  String get invalidPriceRange =>
      'Giá tối thiểu không được lớn hơn giá tối đa.';

  @override
  String get sameDayOnly => 'Chỉ giao trong ngày';

  @override
  String get verifiedProductsOnly => 'Chỉ sản phẩm đã xác minh';

  @override
  String get officialStoresOnly => 'Chỉ gian hàng chính hãng';

  @override
  String get sortNewest => 'Mới nhất';

  @override
  String get sortPriceLowToHigh => 'Giá: Thấp đến cao';

  @override
  String get sortPriceHighToLow => 'Giá: Cao đến thấp';

  @override
  String get someProductsLoadError =>
      'Không thể tải kết quả mới. Đang hiển thị sản phẩm trước đó.';

  @override
  String get cart => 'Giỏ hàng';

  @override
  String get orders => 'Đơn hàng';

  @override
  String get profile => 'Tài khoản';

  @override
  String get login => 'Đăng nhập';

  @override
  String get register => 'Đăng ký';

  @override
  String get logout => 'Đăng xuất';

  @override
  String get email => 'Email';

  @override
  String get password => 'Mật khẩu';

  @override
  String get phone => 'Số điện thoại';

  @override
  String get searchProducts => 'Tìm kiếm sản phẩm…';

  @override
  String get clearSearch => 'Xóa tìm kiếm';

  @override
  String get addToCart => 'Thêm vào giỏ';

  @override
  String get buyNow => 'Mua ngay';

  @override
  String get viewCart => 'Xem giỏ';

  @override
  String itemsAddedToCart(int count) {
    return 'Đã thêm $count sản phẩm vào giỏ hàng';
  }

  @override
  String get copyProductLink => 'Sao chép liên kết sản phẩm';

  @override
  String get productLinkCopied => 'Đã sao chép liên kết sản phẩm';

  @override
  String get addToFavorites => 'Thêm vào yêu thích';

  @override
  String get removeFromFavorites => 'Xóa khỏi yêu thích';

  @override
  String get addedToFavorites => 'Đã thêm vào yêu thích';

  @override
  String get removedFromFavorites => 'Đã xóa khỏi yêu thích';

  @override
  String get wishlistUpdateError =>
      'Không thể cập nhật yêu thích. Vui lòng thử lại.';

  @override
  String get quantity => 'Số lượng';

  @override
  String quantityValue(int count) {
    return 'Số lượng: $count';
  }

  @override
  String get decreaseQuantity => 'Giảm số lượng';

  @override
  String get increaseQuantity => 'Tăng số lượng';

  @override
  String get inStock => 'Còn hàng';

  @override
  String lowStock(int count) {
    return 'Chỉ còn $count sản phẩm';
  }

  @override
  String get outOfStock => 'Hết hàng';

  @override
  String get productDescription => 'Mô tả sản phẩm';

  @override
  String get noProductDescription => 'Không có mô tả cho sản phẩm này.';

  @override
  String get expandDescription => 'Xem toàn bộ mô tả';

  @override
  String get collapseDescription => 'Thu gọn mô tả';

  @override
  String get checkout => 'Thanh toán';

  @override
  String get checkoutDeliveryAddress => 'Địa chỉ giao hàng';

  @override
  String get checkoutDeliveryMethod => 'Phương thức vận chuyển';

  @override
  String get checkoutPaymentMethod => 'Phương thức thanh toán';

  @override
  String get checkoutReviewOrder => 'Kiểm tra đơn hàng';

  @override
  String get defaultLabel => 'Mặc định';

  @override
  String get edit => 'Sửa';

  @override
  String get addNewAddress => 'Thêm địa chỉ mới';

  @override
  String get editAddressTitle => 'Sửa địa chỉ';

  @override
  String get addressDetails => 'Chi tiết địa chỉ';

  @override
  String get streetAddressLabel => 'Địa chỉ đường phố';

  @override
  String get streetAddressHint => 'Số nhà và tên đường';

  @override
  String get wardLabel => 'Phường / Xã';

  @override
  String get wardHint => 'Không bắt buộc';

  @override
  String get districtLabel => 'Quận / Huyện';

  @override
  String get districtHint => 'Nhập quận hoặc huyện';

  @override
  String get cityProvinceLabel => 'Tỉnh / Thành phố';

  @override
  String get cityProvinceHint => 'Nhập tỉnh hoặc thành phố';

  @override
  String requiredField(String field) {
    return 'Vui lòng nhập $field';
  }

  @override
  String get saveAddress => 'Lưu địa chỉ';

  @override
  String get setDefaultAddress => 'Đặt làm địa chỉ mặc định';

  @override
  String get defaultAddressHelp => 'Ưu tiên địa chỉ này cho các đơn hàng sau.';

  @override
  String get addressNotFoundTitle => 'Không tìm thấy địa chỉ';

  @override
  String get addressNotFoundHelp =>
      'Địa chỉ này có thể đã bị xóa. Hãy quay lại thanh toán và chọn địa chỉ khác.';

  @override
  String get addressAddedSuccess => 'Đã thêm địa chỉ';

  @override
  String get addressUpdatedSuccess => 'Đã cập nhật địa chỉ';

  @override
  String get discardAddressTitle => 'Bỏ thay đổi?';

  @override
  String get discardAddressHelp => 'Các thay đổi địa chỉ chưa lưu sẽ bị mất.';

  @override
  String get discardChanges => 'Bỏ thay đổi';

  @override
  String get noAddressTitle => 'Thêm địa chỉ giao hàng';

  @override
  String get noAddressHelp =>
      'Cần có địa chỉ trước khi tính phương thức vận chuyển.';

  @override
  String get deleteAddress => 'Xóa địa chỉ';

  @override
  String deleteAddressConfirmation(String name) {
    return 'Xóa địa chỉ của $name?';
  }

  @override
  String get selectAddressFirst => 'Vui lòng chọn địa chỉ giao hàng trước.';

  @override
  String get shippingMethodsLoadError => 'Không thể tải phương thức vận chuyển';

  @override
  String get noShippingMethods =>
      'Không có phương thức vận chuyển cho địa chỉ này.';

  @override
  String get deliveryToday => 'Giao trong ngày';

  @override
  String deliveryDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Giao trong $count ngày',
      one: 'Giao trong 1 ngày',
    );
    return '$_temp0';
  }

  @override
  String get free => 'Miễn phí';

  @override
  String get paymentMethodsLoadError => 'Không thể tải phương thức thanh toán';

  @override
  String get noPaymentMethods =>
      'Hiện không có phương thức thanh toán khả dụng.';

  @override
  String get paymentCodName => 'Thanh toán khi nhận hàng';

  @override
  String get paymentCodDescription => 'Thanh toán khi đơn hàng được giao';

  @override
  String get paymentVietqrName => 'VietQR';

  @override
  String get paymentVietqrDescription => 'Quét mã QR bằng ứng dụng ngân hàng';

  @override
  String get paymentVnpayName => 'VNPay';

  @override
  String get paymentVnpayDescription => 'Thanh toán qua cổng VNPay';

  @override
  String get paymentMomoName => 'MoMo';

  @override
  String get paymentMomoDescription => 'Thanh toán bằng ví MoMo';

  @override
  String get paymentBankTransferName => 'Chuyển khoản ngân hàng';

  @override
  String get paymentBankTransferDescription =>
      'Chuyển khoản từ tài khoản ngân hàng';

  @override
  String get payNow => 'Thanh toán ngay';

  @override
  String get orderPlacedTitle => 'Đặt hàng thành công';

  @override
  String get orderPlacedHelp =>
      'Đơn hàng đã được tiếp nhận và sẵn sàng để theo dõi.';

  @override
  String orderNumber(String id) {
    return 'Đơn hàng $id';
  }

  @override
  String get viewOrders => 'Xem đơn hàng';

  @override
  String get continueShopping => 'Tiếp tục mua sắm';

  @override
  String get completePayment => 'Hoàn tất thanh toán';

  @override
  String get paymentQrInstruction =>
      'Quét mã QR bằng ứng dụng ngân hàng, sau đó kiểm tra trạng thái thanh toán.';

  @override
  String get openPaymentApp => 'Mở ứng dụng thanh toán';

  @override
  String get checkPaymentStatus => 'Kiểm tra thanh toán';

  @override
  String get paymentQrCode => 'Mã QR thanh toán';

  @override
  String get checkoutInitializeError =>
      'Không thể bắt đầu thanh toán. Hãy quay lại giỏ hàng và thử lại.';

  @override
  String get checkoutAddressesLoadError => 'Không thể tải danh sách địa chỉ.';

  @override
  String get checkoutAddressAddError => 'Không thể thêm địa chỉ.';

  @override
  String get checkoutAddressUpdateError => 'Không thể cập nhật địa chỉ.';

  @override
  String get checkoutAddressDeleteError => 'Không thể xóa địa chỉ.';

  @override
  String get checkoutPaymentUnavailable =>
      'Phương thức thanh toán này không còn khả dụng.';

  @override
  String get checkoutIncompleteError =>
      'Vui lòng chọn địa chỉ, vận chuyển và thanh toán.';

  @override
  String get checkoutUpdateError => 'Không thể cập nhật tổng tiền thanh toán.';

  @override
  String get checkoutPaymentStartError =>
      'Không thể bắt đầu thanh toán. Vui lòng thử lại.';

  @override
  String get checkoutPaymentStatusError =>
      'Không thể cập nhật trạng thái thanh toán.';

  @override
  String get checkoutPaymentFailed =>
      'Thanh toán chưa hoàn tất. Hãy thử lại hoặc chọn phương thức khác.';

  @override
  String get checkoutTransactionMissing =>
      'Không tìm thấy giao dịch thanh toán.';

  @override
  String get checkoutOrderCreateError =>
      'Không thể tạo đơn hàng. Vui lòng thử lại.';

  @override
  String get checkoutOrderCancelError => 'Không thể hủy đơn hàng.';

  @override
  String get placeOrder => 'Đặt hàng ngay';

  @override
  String get total => 'Tổng cộng';

  @override
  String get subtotal => 'Tạm tính';

  @override
  String get shipping => 'Phí giao hàng';

  @override
  String get discount => 'Giảm giá';

  @override
  String get emptyCart => 'Giỏ hàng trống';

  @override
  String cartItemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sản phẩm',
      one: '1 sản phẩm',
    );
    return '$_temp0';
  }

  @override
  String cartSelectionCount(int selected, int total) {
    return 'Đã chọn $selected/$total';
  }

  @override
  String get selectAll => 'Chọn tất cả';

  @override
  String get clearCart => 'Xóa giỏ hàng';

  @override
  String get clearCartConfirmation => 'Xóa toàn bộ sản phẩm khỏi giỏ hàng?';

  @override
  String get clearAll => 'Xóa tất cả';

  @override
  String get emptyCartHelp => 'Sản phẩm bạn thêm sẽ xuất hiện tại đây.';

  @override
  String get shopNow => 'Mua sắm ngay';

  @override
  String get cartLoadError => 'Không thể tải giỏ hàng';

  @override
  String get cartLoadErrorHelp => 'Kiểm tra kết nối rồi thử lại.';

  @override
  String get cartAddError => 'Không thể thêm sản phẩm. Vui lòng thử lại.';

  @override
  String get cartRemoveError => 'Không thể xóa sản phẩm. Vui lòng thử lại.';

  @override
  String get cartQuantityError =>
      'Không thể cập nhật số lượng. Vui lòng thử lại.';

  @override
  String get cartInvalidCoupon =>
      'Mã giảm giá không hợp lệ hoặc không khả dụng.';

  @override
  String get cartRemoveCouponError =>
      'Không thể xóa mã giảm giá. Vui lòng thử lại.';

  @override
  String get cartClearError => 'Không thể xóa giỏ hàng. Vui lòng thử lại.';

  @override
  String get cartSyncError => 'Không thể đồng bộ giỏ hàng. Vui lòng thử lại.';

  @override
  String get cartCheckoutCleanupError =>
      'Đơn hàng đã được tạo nhưng giỏ hàng chưa thể cập nhật.';

  @override
  String get removeCartItem => 'Xóa sản phẩm';

  @override
  String removeCartItemConfirmation(String name) {
    return 'Xóa $name khỏi giỏ hàng?';
  }

  @override
  String get remove => 'Xóa';

  @override
  String get couponTitle => 'Mã giảm giá';

  @override
  String get couponHint => 'Nhập mã giảm giá';

  @override
  String get applyCoupon => 'Áp dụng';

  @override
  String get couponApplied => 'Đã áp dụng';

  @override
  String couponAppliedCode(String code) {
    return 'Mã: $code';
  }

  @override
  String get orderSummary => 'Tóm tắt đơn hàng';

  @override
  String get selectedSubtotal => 'Tạm tính đã chọn';

  @override
  String get shippingCalculatedAtCheckout => 'Tính khi thanh toán';

  @override
  String get estimatedTotal => 'Tổng tạm tính';

  @override
  String get vatIncluded => 'Đã gồm VAT khi áp dụng';

  @override
  String get discountRecalculatedAtCheckout =>
      'Ưu đãi sẽ được tính lại cho các sản phẩm đã chọn khi thanh toán.';

  @override
  String checkoutItemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Thanh toán ($count)',
      one: 'Thanh toán (1)',
    );
    return '$_temp0';
  }

  @override
  String get checkoutEmptyTitle => 'Chưa chọn sản phẩm';

  @override
  String get checkoutEmptyHelp =>
      'Quay lại giỏ hàng và chọn ít nhất một sản phẩm để tiếp tục.';

  @override
  String get backToCart => 'Quay lại giỏ hàng';

  @override
  String get emptyOrders => 'Chưa có đơn hàng';

  @override
  String get noResults => 'Không tìm thấy kết quả';

  @override
  String get error => 'Đã xảy ra lỗi';

  @override
  String get retry => 'Thử lại';

  @override
  String get cancel => 'Hủy';

  @override
  String get confirm => 'Xác nhận';

  @override
  String get success => 'Thành công';

  @override
  String get processing => 'Đang xử lý...';

  @override
  String get loading => 'Đang tải...';

  @override
  String get customerReviews => 'Đánh giá của khách hàng';

  @override
  String get reviewSectionSubtitle =>
      'Điểm số và nhận xét từ những người đã mua sản phẩm này.';

  @override
  String reviewCount(int count) {
    return '$count đánh giá';
  }

  @override
  String reviewRatingOption(int count) {
    return '$count sao';
  }

  @override
  String reviewRatingBreakdown(int count) {
    return 'Đánh giá $count sao';
  }

  @override
  String get yourReview => 'Nội dung đánh giá';

  @override
  String get shareReviewExperience => 'Chia sẻ trải nghiệm về sản phẩm...';

  @override
  String get submitReview => 'Gửi đánh giá';

  @override
  String get submittingReview => 'Đang gửi...';

  @override
  String get signInToReview => 'Đăng nhập để chia sẻ trải nghiệm của bạn.';

  @override
  String get signIn => 'Đăng nhập';

  @override
  String get verifiedPurchase => 'Đã mua hàng';

  @override
  String get anonymousCustomer => 'Khách hàng';

  @override
  String helpfulCount(int count) {
    return 'Hữu ích ($count)';
  }

  @override
  String get saving => 'Đang lưu...';

  @override
  String get noReviewsTitle => 'Hãy là người đầu tiên đánh giá sản phẩm này';

  @override
  String get noReviewsSubtitle =>
      'Chia sẻ trải nghiệm để giúp những người mua khác.';

  @override
  String get reviewsLoadError => 'Không thể tải đánh giá';

  @override
  String get reviewsLoadErrorHelp => 'Kiểm tra kết nối và thử lại.';

  @override
  String get tryAgain => 'Thử lại';

  @override
  String get reviewPublished => 'Đã đăng';

  @override
  String get reviewPending => 'Đang chờ kiểm duyệt';

  @override
  String get reviewRejected => 'Đánh giá không được đăng';

  @override
  String get reviewPublishedNotice => 'Đánh giá của bạn đã được đăng.';

  @override
  String get reviewPendingNotice => 'Đánh giá đã được gửi để kiểm duyệt.';

  @override
  String get reviewRejectedNotice => 'Đánh giá của bạn không thể được đăng.';

  @override
  String get reviewSubmitError => 'Không thể gửi đánh giá. Vui lòng thử lại.';

  @override
  String get reviewVoteError => 'Không thể lưu lượt hữu ích. Vui lòng thử lại.';

  @override
  String reviewImageLabel(int count) {
    return 'Hình ảnh đánh giá $count';
  }

  @override
  String get myOrders => 'Đơn hàng của tôi';

  @override
  String get orderDetailTitle => 'Chi tiết đơn hàng';

  @override
  String get orderAll => 'Tất cả';

  @override
  String get orderStatusPending => 'Chờ xác nhận';

  @override
  String get orderStatusConfirmed => 'Đã xác nhận';

  @override
  String get orderStatusProcessing => 'Đang xử lý';

  @override
  String get orderStatusShipped => 'Đang giao';

  @override
  String get orderStatusDelivered => 'Đã giao';

  @override
  String get orderStatusCancelled => 'Đã hủy';

  @override
  String orderListCount(int count) {
    return '$count đơn hàng';
  }

  @override
  String orderItemsCount(int count) {
    return '$count sản phẩm';
  }

  @override
  String get orderEmptyHelp =>
      'Các đơn hàng bạn đặt sẽ xuất hiện tại đây để theo dõi.';

  @override
  String get orderEmptyFilteredTitle => 'Không có đơn hàng ở trạng thái này';

  @override
  String get orderEmptyFilteredHelp =>
      'Chọn trạng thái khác hoặc xem tất cả đơn hàng.';

  @override
  String get ordersLoadError => 'Không thể tải đơn hàng';

  @override
  String get orderNetworkError => 'Kiểm tra kết nối rồi thử lại.';

  @override
  String get orderUnauthorizedError =>
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

  @override
  String get orderForbiddenError => 'Bạn không có quyền xem đơn hàng này.';

  @override
  String get orderNotFoundError => 'Không tìm thấy đơn hàng này.';

  @override
  String get orderServerError =>
      'Dịch vụ đơn hàng đang gián đoạn. Vui lòng thử lại sau.';

  @override
  String get orderRequestCancelledError => 'Yêu cầu đã bị hủy.';

  @override
  String get orderUnknownError => 'Đã xảy ra lỗi. Vui lòng thử lại.';

  @override
  String get orderCancelledSuccess => 'Đã hủy đơn hàng';

  @override
  String get cancelOrder => 'Hủy đơn hàng';

  @override
  String get cancellingOrder => 'Đang hủy...';

  @override
  String get cancelOrderTitle => 'Hủy đơn hàng này?';

  @override
  String get cancelOrderConfirmation => 'Thao tác này không thể hoàn tác.';

  @override
  String get keepOrder => 'Giữ đơn hàng';

  @override
  String get confirmCancelOrder => 'Có, hủy đơn hàng';

  @override
  String get orderStatusSection => 'Trạng thái đơn hàng';

  @override
  String get deliveryAddress => 'Địa chỉ giao hàng';

  @override
  String get orderProducts => 'Sản phẩm';

  @override
  String get paymentInformation => 'Thanh toán';

  @override
  String get orderInformation => 'Thông tin đơn hàng';

  @override
  String get orderCode => 'Mã đơn hàng';

  @override
  String get placedAt => 'Ngày đặt';

  @override
  String get updatedAt => 'Cập nhật gần nhất';

  @override
  String get paymentMethod => 'Phương thức thanh toán';

  @override
  String get paymentStatus => 'Trạng thái thanh toán';

  @override
  String get paid => 'Đã thanh toán';

  @override
  String get unpaid => 'Chưa thanh toán';

  @override
  String get trackingNumber => 'Mã vận đơn';

  @override
  String get carrier => 'Đơn vị vận chuyển';

  @override
  String get shippingMethod => 'Phương thức giao hàng';

  @override
  String get orderProductsUnavailable =>
      'Thông tin sản phẩm của đơn hàng này hiện không khả dụng.';

  @override
  String quantityShort(int count) {
    return 'SL $count';
  }
}
