import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_vi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('vi'),
    Locale('en'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In vi, this message translates to:
  /// **'VNShop'**
  String get appTitle;

  /// No description provided for @home.
  ///
  /// In vi, this message translates to:
  /// **'Trang chủ'**
  String get home;

  /// No description provided for @products.
  ///
  /// In vi, this message translates to:
  /// **'Sản phẩm'**
  String get products;

  /// No description provided for @browseProducts.
  ///
  /// In vi, this message translates to:
  /// **'Khám phá sản phẩm'**
  String get browseProducts;

  /// No description provided for @allCategories.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get allCategories;

  /// No description provided for @productsFound.
  ///
  /// In vi, this message translates to:
  /// **'{count} sản phẩm'**
  String productsFound(int count);

  /// No description provided for @notifications.
  ///
  /// In vi, this message translates to:
  /// **'Thông báo'**
  String get notifications;

  /// No description provided for @favorites.
  ///
  /// In vi, this message translates to:
  /// **'Yêu thích'**
  String get favorites;

  /// No description provided for @favoritesCount.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, =1 {1 sản phẩm đã lưu} other {{count} sản phẩm đã lưu}}'**
  String favoritesCount(int count);

  /// No description provided for @noFavoritesTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có sản phẩm yêu thích'**
  String get noFavoritesTitle;

  /// No description provided for @noFavoritesSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Lưu sản phẩm để tìm lại nhanh chóng tại đây.'**
  String get noFavoritesSubtitle;

  /// No description provided for @favoritesLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải sản phẩm yêu thích'**
  String get favoritesLoadError;

  /// No description provided for @favoritesLoadHelp.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối rồi thử lại.'**
  String get favoritesLoadHelp;

  /// No description provided for @someFavoritesLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải một số sản phẩm đã lưu.'**
  String get someFavoritesLoadError;

  /// No description provided for @refresh.
  ///
  /// In vi, this message translates to:
  /// **'Làm mới'**
  String get refresh;

  /// No description provided for @homeProductsLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải sản phẩm'**
  String get homeProductsLoadError;

  /// No description provided for @homeProductsLoadHelp.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối và thử lại.'**
  String get homeProductsLoadHelp;

  /// No description provided for @noProductsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy sản phẩm'**
  String get noProductsTitle;

  /// No description provided for @noProductsSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Hãy thử từ khóa hoặc danh mục khác.'**
  String get noProductsSubtitle;

  /// No description provided for @filters.
  ///
  /// In vi, this message translates to:
  /// **'Bộ lọc'**
  String get filters;

  /// No description provided for @sortProducts.
  ///
  /// In vi, this message translates to:
  /// **'Sắp xếp sản phẩm'**
  String get sortProducts;

  /// No description provided for @clearFilters.
  ///
  /// In vi, this message translates to:
  /// **'Xóa bộ lọc'**
  String get clearFilters;

  /// No description provided for @resetFilters.
  ///
  /// In vi, this message translates to:
  /// **'Đặt lại'**
  String get resetFilters;

  /// No description provided for @applyFilters.
  ///
  /// In vi, this message translates to:
  /// **'Áp dụng bộ lọc'**
  String get applyFilters;

  /// No description provided for @minimumPrice.
  ///
  /// In vi, this message translates to:
  /// **'Giá tối thiểu'**
  String get minimumPrice;

  /// No description provided for @maximumPrice.
  ///
  /// In vi, this message translates to:
  /// **'Giá tối đa'**
  String get maximumPrice;

  /// No description provided for @invalidPrice.
  ///
  /// In vi, this message translates to:
  /// **'Nhập mức giá hợp lệ.'**
  String get invalidPrice;

  /// No description provided for @invalidPriceRange.
  ///
  /// In vi, this message translates to:
  /// **'Giá tối thiểu không được lớn hơn giá tối đa.'**
  String get invalidPriceRange;

  /// No description provided for @sameDayOnly.
  ///
  /// In vi, this message translates to:
  /// **'Chỉ giao trong ngày'**
  String get sameDayOnly;

  /// No description provided for @verifiedProductsOnly.
  ///
  /// In vi, this message translates to:
  /// **'Chỉ sản phẩm đã xác minh'**
  String get verifiedProductsOnly;

  /// No description provided for @officialStoresOnly.
  ///
  /// In vi, this message translates to:
  /// **'Chỉ gian hàng chính hãng'**
  String get officialStoresOnly;

  /// No description provided for @sortNewest.
  ///
  /// In vi, this message translates to:
  /// **'Mới nhất'**
  String get sortNewest;

  /// No description provided for @sortPriceLowToHigh.
  ///
  /// In vi, this message translates to:
  /// **'Giá: Thấp đến cao'**
  String get sortPriceLowToHigh;

  /// No description provided for @sortPriceHighToLow.
  ///
  /// In vi, this message translates to:
  /// **'Giá: Cao đến thấp'**
  String get sortPriceHighToLow;

  /// No description provided for @someProductsLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải kết quả mới. Đang hiển thị sản phẩm trước đó.'**
  String get someProductsLoadError;

  /// No description provided for @cart.
  ///
  /// In vi, this message translates to:
  /// **'Giỏ hàng'**
  String get cart;

  /// No description provided for @orders.
  ///
  /// In vi, this message translates to:
  /// **'Đơn hàng'**
  String get orders;

  /// No description provided for @profile.
  ///
  /// In vi, this message translates to:
  /// **'Tài khoản'**
  String get profile;

  /// No description provided for @login.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập'**
  String get login;

  /// No description provided for @register.
  ///
  /// In vi, this message translates to:
  /// **'Đăng ký'**
  String get register;

  /// No description provided for @logout.
  ///
  /// In vi, this message translates to:
  /// **'Đăng xuất'**
  String get logout;

  /// No description provided for @email.
  ///
  /// In vi, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In vi, this message translates to:
  /// **'Mật khẩu'**
  String get password;

  /// No description provided for @phone.
  ///
  /// In vi, this message translates to:
  /// **'Số điện thoại'**
  String get phone;

  /// No description provided for @searchProducts.
  ///
  /// In vi, this message translates to:
  /// **'Tìm kiếm sản phẩm…'**
  String get searchProducts;

  /// No description provided for @clearSearch.
  ///
  /// In vi, this message translates to:
  /// **'Xóa tìm kiếm'**
  String get clearSearch;

  /// No description provided for @addToCart.
  ///
  /// In vi, this message translates to:
  /// **'Thêm vào giỏ'**
  String get addToCart;

  /// No description provided for @buyNow.
  ///
  /// In vi, this message translates to:
  /// **'Mua ngay'**
  String get buyNow;

  /// No description provided for @viewCart.
  ///
  /// In vi, this message translates to:
  /// **'Xem giỏ'**
  String get viewCart;

  /// No description provided for @itemsAddedToCart.
  ///
  /// In vi, this message translates to:
  /// **'Đã thêm {count} sản phẩm vào giỏ hàng'**
  String itemsAddedToCart(int count);

  /// No description provided for @copyProductLink.
  ///
  /// In vi, this message translates to:
  /// **'Sao chép liên kết sản phẩm'**
  String get copyProductLink;

  /// No description provided for @productLinkCopied.
  ///
  /// In vi, this message translates to:
  /// **'Đã sao chép liên kết sản phẩm'**
  String get productLinkCopied;

  /// No description provided for @addToFavorites.
  ///
  /// In vi, this message translates to:
  /// **'Thêm vào yêu thích'**
  String get addToFavorites;

  /// No description provided for @removeFromFavorites.
  ///
  /// In vi, this message translates to:
  /// **'Xóa khỏi yêu thích'**
  String get removeFromFavorites;

  /// No description provided for @addedToFavorites.
  ///
  /// In vi, this message translates to:
  /// **'Đã thêm vào yêu thích'**
  String get addedToFavorites;

  /// No description provided for @removedFromFavorites.
  ///
  /// In vi, this message translates to:
  /// **'Đã xóa khỏi yêu thích'**
  String get removedFromFavorites;

  /// No description provided for @wishlistUpdateError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể cập nhật yêu thích. Vui lòng thử lại.'**
  String get wishlistUpdateError;

  /// No description provided for @quantity.
  ///
  /// In vi, this message translates to:
  /// **'Số lượng'**
  String get quantity;

  /// No description provided for @quantityValue.
  ///
  /// In vi, this message translates to:
  /// **'Số lượng: {count}'**
  String quantityValue(int count);

  /// No description provided for @decreaseQuantity.
  ///
  /// In vi, this message translates to:
  /// **'Giảm số lượng'**
  String get decreaseQuantity;

  /// No description provided for @increaseQuantity.
  ///
  /// In vi, this message translates to:
  /// **'Tăng số lượng'**
  String get increaseQuantity;

  /// No description provided for @inStock.
  ///
  /// In vi, this message translates to:
  /// **'Còn hàng'**
  String get inStock;

  /// No description provided for @lowStock.
  ///
  /// In vi, this message translates to:
  /// **'Chỉ còn {count} sản phẩm'**
  String lowStock(int count);

  /// No description provided for @outOfStock.
  ///
  /// In vi, this message translates to:
  /// **'Hết hàng'**
  String get outOfStock;

  /// No description provided for @productDescription.
  ///
  /// In vi, this message translates to:
  /// **'Mô tả sản phẩm'**
  String get productDescription;

  /// No description provided for @noProductDescription.
  ///
  /// In vi, this message translates to:
  /// **'Không có mô tả cho sản phẩm này.'**
  String get noProductDescription;

  /// No description provided for @expandDescription.
  ///
  /// In vi, this message translates to:
  /// **'Xem toàn bộ mô tả'**
  String get expandDescription;

  /// No description provided for @collapseDescription.
  ///
  /// In vi, this message translates to:
  /// **'Thu gọn mô tả'**
  String get collapseDescription;

  /// No description provided for @checkout.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán'**
  String get checkout;

  /// No description provided for @checkoutDeliveryAddress.
  ///
  /// In vi, this message translates to:
  /// **'Địa chỉ giao hàng'**
  String get checkoutDeliveryAddress;

  /// No description provided for @checkoutDeliveryMethod.
  ///
  /// In vi, this message translates to:
  /// **'Phương thức vận chuyển'**
  String get checkoutDeliveryMethod;

  /// No description provided for @checkoutPaymentMethod.
  ///
  /// In vi, this message translates to:
  /// **'Phương thức thanh toán'**
  String get checkoutPaymentMethod;

  /// No description provided for @checkoutReviewOrder.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra đơn hàng'**
  String get checkoutReviewOrder;

  /// No description provided for @defaultLabel.
  ///
  /// In vi, this message translates to:
  /// **'Mặc định'**
  String get defaultLabel;

  /// No description provided for @edit.
  ///
  /// In vi, this message translates to:
  /// **'Sửa'**
  String get edit;

  /// No description provided for @addNewAddress.
  ///
  /// In vi, this message translates to:
  /// **'Thêm địa chỉ mới'**
  String get addNewAddress;

  /// No description provided for @editAddressTitle.
  ///
  /// In vi, this message translates to:
  /// **'Sửa địa chỉ'**
  String get editAddressTitle;

  /// No description provided for @addressDetails.
  ///
  /// In vi, this message translates to:
  /// **'Chi tiết địa chỉ'**
  String get addressDetails;

  /// No description provided for @streetAddressLabel.
  ///
  /// In vi, this message translates to:
  /// **'Địa chỉ đường phố'**
  String get streetAddressLabel;

  /// No description provided for @streetAddressHint.
  ///
  /// In vi, this message translates to:
  /// **'Số nhà và tên đường'**
  String get streetAddressHint;

  /// No description provided for @wardLabel.
  ///
  /// In vi, this message translates to:
  /// **'Phường / Xã'**
  String get wardLabel;

  /// No description provided for @wardHint.
  ///
  /// In vi, this message translates to:
  /// **'Không bắt buộc'**
  String get wardHint;

  /// No description provided for @districtLabel.
  ///
  /// In vi, this message translates to:
  /// **'Quận / Huyện'**
  String get districtLabel;

  /// No description provided for @districtHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập quận hoặc huyện'**
  String get districtHint;

  /// No description provided for @cityProvinceLabel.
  ///
  /// In vi, this message translates to:
  /// **'Tỉnh / Thành phố'**
  String get cityProvinceLabel;

  /// No description provided for @cityProvinceHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập tỉnh hoặc thành phố'**
  String get cityProvinceHint;

  /// No description provided for @requiredField.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng nhập {field}'**
  String requiredField(String field);

  /// No description provided for @saveAddress.
  ///
  /// In vi, this message translates to:
  /// **'Lưu địa chỉ'**
  String get saveAddress;

  /// No description provided for @setDefaultAddress.
  ///
  /// In vi, this message translates to:
  /// **'Đặt làm địa chỉ mặc định'**
  String get setDefaultAddress;

  /// No description provided for @defaultAddressHelp.
  ///
  /// In vi, this message translates to:
  /// **'Ưu tiên địa chỉ này cho các đơn hàng sau.'**
  String get defaultAddressHelp;

  /// No description provided for @addressNotFoundTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy địa chỉ'**
  String get addressNotFoundTitle;

  /// No description provided for @addressNotFoundHelp.
  ///
  /// In vi, this message translates to:
  /// **'Địa chỉ này có thể đã bị xóa. Hãy quay lại thanh toán và chọn địa chỉ khác.'**
  String get addressNotFoundHelp;

  /// No description provided for @addressAddedSuccess.
  ///
  /// In vi, this message translates to:
  /// **'Đã thêm địa chỉ'**
  String get addressAddedSuccess;

  /// No description provided for @addressUpdatedSuccess.
  ///
  /// In vi, this message translates to:
  /// **'Đã cập nhật địa chỉ'**
  String get addressUpdatedSuccess;

  /// No description provided for @discardAddressTitle.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ thay đổi?'**
  String get discardAddressTitle;

  /// No description provided for @discardAddressHelp.
  ///
  /// In vi, this message translates to:
  /// **'Các thay đổi địa chỉ chưa lưu sẽ bị mất.'**
  String get discardAddressHelp;

  /// No description provided for @discardChanges.
  ///
  /// In vi, this message translates to:
  /// **'Bỏ thay đổi'**
  String get discardChanges;

  /// No description provided for @noAddressTitle.
  ///
  /// In vi, this message translates to:
  /// **'Thêm địa chỉ giao hàng'**
  String get noAddressTitle;

  /// No description provided for @noAddressHelp.
  ///
  /// In vi, this message translates to:
  /// **'Cần có địa chỉ trước khi tính phương thức vận chuyển.'**
  String get noAddressHelp;

  /// No description provided for @deleteAddress.
  ///
  /// In vi, this message translates to:
  /// **'Xóa địa chỉ'**
  String get deleteAddress;

  /// No description provided for @deleteAddressConfirmation.
  ///
  /// In vi, this message translates to:
  /// **'Xóa địa chỉ của {name}?'**
  String deleteAddressConfirmation(String name);

  /// No description provided for @selectAddressFirst.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng chọn địa chỉ giao hàng trước.'**
  String get selectAddressFirst;

  /// No description provided for @shippingMethodsLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải phương thức vận chuyển'**
  String get shippingMethodsLoadError;

  /// No description provided for @noShippingMethods.
  ///
  /// In vi, this message translates to:
  /// **'Không có phương thức vận chuyển cho địa chỉ này.'**
  String get noShippingMethods;

  /// No description provided for @deliveryToday.
  ///
  /// In vi, this message translates to:
  /// **'Giao trong ngày'**
  String get deliveryToday;

  /// No description provided for @deliveryDays.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, =1 {Giao trong 1 ngày} other {Giao trong {count} ngày}}'**
  String deliveryDays(int count);

  /// No description provided for @free.
  ///
  /// In vi, this message translates to:
  /// **'Miễn phí'**
  String get free;

  /// No description provided for @paymentMethodsLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải phương thức thanh toán'**
  String get paymentMethodsLoadError;

  /// No description provided for @noPaymentMethods.
  ///
  /// In vi, this message translates to:
  /// **'Hiện không có phương thức thanh toán khả dụng.'**
  String get noPaymentMethods;

  /// No description provided for @paymentCodName.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán khi nhận hàng'**
  String get paymentCodName;

  /// No description provided for @paymentCodDescription.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán khi đơn hàng được giao'**
  String get paymentCodDescription;

  /// No description provided for @paymentVietqrName.
  ///
  /// In vi, this message translates to:
  /// **'VietQR'**
  String get paymentVietqrName;

  /// No description provided for @paymentVietqrDescription.
  ///
  /// In vi, this message translates to:
  /// **'Quét mã QR bằng ứng dụng ngân hàng'**
  String get paymentVietqrDescription;

  /// No description provided for @paymentVnpayName.
  ///
  /// In vi, this message translates to:
  /// **'VNPay'**
  String get paymentVnpayName;

  /// No description provided for @paymentVnpayDescription.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán qua cổng VNPay'**
  String get paymentVnpayDescription;

  /// No description provided for @paymentMomoName.
  ///
  /// In vi, this message translates to:
  /// **'MoMo'**
  String get paymentMomoName;

  /// No description provided for @paymentMomoDescription.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán bằng ví MoMo'**
  String get paymentMomoDescription;

  /// No description provided for @paymentBankTransferName.
  ///
  /// In vi, this message translates to:
  /// **'Chuyển khoản ngân hàng'**
  String get paymentBankTransferName;

  /// No description provided for @paymentBankTransferDescription.
  ///
  /// In vi, this message translates to:
  /// **'Chuyển khoản từ tài khoản ngân hàng'**
  String get paymentBankTransferDescription;

  /// No description provided for @payNow.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán ngay'**
  String get payNow;

  /// No description provided for @orderPlacedTitle.
  ///
  /// In vi, this message translates to:
  /// **'Đặt hàng thành công'**
  String get orderPlacedTitle;

  /// No description provided for @orderPlacedHelp.
  ///
  /// In vi, this message translates to:
  /// **'Đơn hàng đã được tiếp nhận và sẵn sàng để theo dõi.'**
  String get orderPlacedHelp;

  /// No description provided for @orderNumber.
  ///
  /// In vi, this message translates to:
  /// **'Đơn hàng {id}'**
  String orderNumber(String id);

  /// No description provided for @viewOrders.
  ///
  /// In vi, this message translates to:
  /// **'Xem đơn hàng'**
  String get viewOrders;

  /// No description provided for @continueShopping.
  ///
  /// In vi, this message translates to:
  /// **'Tiếp tục mua sắm'**
  String get continueShopping;

  /// No description provided for @completePayment.
  ///
  /// In vi, this message translates to:
  /// **'Hoàn tất thanh toán'**
  String get completePayment;

  /// No description provided for @paymentQrInstruction.
  ///
  /// In vi, this message translates to:
  /// **'Quét mã QR bằng ứng dụng ngân hàng, sau đó kiểm tra trạng thái thanh toán.'**
  String get paymentQrInstruction;

  /// No description provided for @openPaymentApp.
  ///
  /// In vi, this message translates to:
  /// **'Mở ứng dụng thanh toán'**
  String get openPaymentApp;

  /// No description provided for @checkPaymentStatus.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra thanh toán'**
  String get checkPaymentStatus;

  /// No description provided for @paymentQrCode.
  ///
  /// In vi, this message translates to:
  /// **'Mã QR thanh toán'**
  String get paymentQrCode;

  /// No description provided for @checkoutInitializeError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể bắt đầu thanh toán. Hãy quay lại giỏ hàng và thử lại.'**
  String get checkoutInitializeError;

  /// No description provided for @checkoutAddressesLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải danh sách địa chỉ.'**
  String get checkoutAddressesLoadError;

  /// No description provided for @checkoutAddressAddError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể thêm địa chỉ.'**
  String get checkoutAddressAddError;

  /// No description provided for @checkoutAddressUpdateError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể cập nhật địa chỉ.'**
  String get checkoutAddressUpdateError;

  /// No description provided for @checkoutAddressDeleteError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể xóa địa chỉ.'**
  String get checkoutAddressDeleteError;

  /// No description provided for @checkoutPaymentUnavailable.
  ///
  /// In vi, this message translates to:
  /// **'Phương thức thanh toán này không còn khả dụng.'**
  String get checkoutPaymentUnavailable;

  /// No description provided for @checkoutIncompleteError.
  ///
  /// In vi, this message translates to:
  /// **'Vui lòng chọn địa chỉ, vận chuyển và thanh toán.'**
  String get checkoutIncompleteError;

  /// No description provided for @checkoutUpdateError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể cập nhật tổng tiền thanh toán.'**
  String get checkoutUpdateError;

  /// No description provided for @checkoutPaymentStartError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể bắt đầu thanh toán. Vui lòng thử lại.'**
  String get checkoutPaymentStartError;

  /// No description provided for @checkoutPaymentStatusError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể cập nhật trạng thái thanh toán.'**
  String get checkoutPaymentStatusError;

  /// No description provided for @checkoutPaymentFailed.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán chưa hoàn tất. Hãy thử lại hoặc chọn phương thức khác.'**
  String get checkoutPaymentFailed;

  /// No description provided for @checkoutTransactionMissing.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy giao dịch thanh toán.'**
  String get checkoutTransactionMissing;

  /// No description provided for @checkoutOrderCreateError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tạo đơn hàng. Vui lòng thử lại.'**
  String get checkoutOrderCreateError;

  /// No description provided for @checkoutOrderCancelError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể hủy đơn hàng.'**
  String get checkoutOrderCancelError;

  /// No description provided for @placeOrder.
  ///
  /// In vi, this message translates to:
  /// **'Đặt hàng ngay'**
  String get placeOrder;

  /// No description provided for @total.
  ///
  /// In vi, this message translates to:
  /// **'Tổng cộng'**
  String get total;

  /// No description provided for @subtotal.
  ///
  /// In vi, this message translates to:
  /// **'Tạm tính'**
  String get subtotal;

  /// No description provided for @shipping.
  ///
  /// In vi, this message translates to:
  /// **'Phí giao hàng'**
  String get shipping;

  /// No description provided for @discount.
  ///
  /// In vi, this message translates to:
  /// **'Giảm giá'**
  String get discount;

  /// No description provided for @emptyCart.
  ///
  /// In vi, this message translates to:
  /// **'Giỏ hàng trống'**
  String get emptyCart;

  /// No description provided for @cartItemCount.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, =1 {1 sản phẩm} other {{count} sản phẩm}}'**
  String cartItemCount(int count);

  /// No description provided for @cartSelectionCount.
  ///
  /// In vi, this message translates to:
  /// **'Đã chọn {selected}/{total}'**
  String cartSelectionCount(int selected, int total);

  /// No description provided for @selectAll.
  ///
  /// In vi, this message translates to:
  /// **'Chọn tất cả'**
  String get selectAll;

  /// No description provided for @clearCart.
  ///
  /// In vi, this message translates to:
  /// **'Xóa giỏ hàng'**
  String get clearCart;

  /// No description provided for @clearCartConfirmation.
  ///
  /// In vi, this message translates to:
  /// **'Xóa toàn bộ sản phẩm khỏi giỏ hàng?'**
  String get clearCartConfirmation;

  /// No description provided for @clearAll.
  ///
  /// In vi, this message translates to:
  /// **'Xóa tất cả'**
  String get clearAll;

  /// No description provided for @emptyCartHelp.
  ///
  /// In vi, this message translates to:
  /// **'Sản phẩm bạn thêm sẽ xuất hiện tại đây.'**
  String get emptyCartHelp;

  /// No description provided for @shopNow.
  ///
  /// In vi, this message translates to:
  /// **'Mua sắm ngay'**
  String get shopNow;

  /// No description provided for @cartLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải giỏ hàng'**
  String get cartLoadError;

  /// No description provided for @cartLoadErrorHelp.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối rồi thử lại.'**
  String get cartLoadErrorHelp;

  /// No description provided for @cartAddError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể thêm sản phẩm. Vui lòng thử lại.'**
  String get cartAddError;

  /// No description provided for @cartRemoveError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể xóa sản phẩm. Vui lòng thử lại.'**
  String get cartRemoveError;

  /// No description provided for @cartQuantityError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể cập nhật số lượng. Vui lòng thử lại.'**
  String get cartQuantityError;

  /// No description provided for @cartInvalidCoupon.
  ///
  /// In vi, this message translates to:
  /// **'Mã giảm giá không hợp lệ hoặc không khả dụng.'**
  String get cartInvalidCoupon;

  /// No description provided for @cartRemoveCouponError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể xóa mã giảm giá. Vui lòng thử lại.'**
  String get cartRemoveCouponError;

  /// No description provided for @cartClearError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể xóa giỏ hàng. Vui lòng thử lại.'**
  String get cartClearError;

  /// No description provided for @cartSyncError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể đồng bộ giỏ hàng. Vui lòng thử lại.'**
  String get cartSyncError;

  /// No description provided for @cartCheckoutCleanupError.
  ///
  /// In vi, this message translates to:
  /// **'Đơn hàng đã được tạo nhưng giỏ hàng chưa thể cập nhật.'**
  String get cartCheckoutCleanupError;

  /// No description provided for @removeCartItem.
  ///
  /// In vi, this message translates to:
  /// **'Xóa sản phẩm'**
  String get removeCartItem;

  /// No description provided for @removeCartItemConfirmation.
  ///
  /// In vi, this message translates to:
  /// **'Xóa {name} khỏi giỏ hàng?'**
  String removeCartItemConfirmation(String name);

  /// No description provided for @remove.
  ///
  /// In vi, this message translates to:
  /// **'Xóa'**
  String get remove;

  /// No description provided for @couponTitle.
  ///
  /// In vi, this message translates to:
  /// **'Mã giảm giá'**
  String get couponTitle;

  /// No description provided for @couponHint.
  ///
  /// In vi, this message translates to:
  /// **'Nhập mã giảm giá'**
  String get couponHint;

  /// No description provided for @applyCoupon.
  ///
  /// In vi, this message translates to:
  /// **'Áp dụng'**
  String get applyCoupon;

  /// No description provided for @couponApplied.
  ///
  /// In vi, this message translates to:
  /// **'Đã áp dụng'**
  String get couponApplied;

  /// No description provided for @couponAppliedCode.
  ///
  /// In vi, this message translates to:
  /// **'Mã: {code}'**
  String couponAppliedCode(String code);

  /// No description provided for @orderSummary.
  ///
  /// In vi, this message translates to:
  /// **'Tóm tắt đơn hàng'**
  String get orderSummary;

  /// No description provided for @selectedSubtotal.
  ///
  /// In vi, this message translates to:
  /// **'Tạm tính đã chọn'**
  String get selectedSubtotal;

  /// No description provided for @shippingCalculatedAtCheckout.
  ///
  /// In vi, this message translates to:
  /// **'Tính khi thanh toán'**
  String get shippingCalculatedAtCheckout;

  /// No description provided for @estimatedTotal.
  ///
  /// In vi, this message translates to:
  /// **'Tổng tạm tính'**
  String get estimatedTotal;

  /// No description provided for @vatIncluded.
  ///
  /// In vi, this message translates to:
  /// **'Đã gồm VAT khi áp dụng'**
  String get vatIncluded;

  /// No description provided for @discountRecalculatedAtCheckout.
  ///
  /// In vi, this message translates to:
  /// **'Ưu đãi sẽ được tính lại cho các sản phẩm đã chọn khi thanh toán.'**
  String get discountRecalculatedAtCheckout;

  /// No description provided for @checkoutItemCount.
  ///
  /// In vi, this message translates to:
  /// **'{count, plural, =1 {Thanh toán (1)} other {Thanh toán ({count})}}'**
  String checkoutItemCount(int count);

  /// No description provided for @checkoutEmptyTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chưa chọn sản phẩm'**
  String get checkoutEmptyTitle;

  /// No description provided for @checkoutEmptyHelp.
  ///
  /// In vi, this message translates to:
  /// **'Quay lại giỏ hàng và chọn ít nhất một sản phẩm để tiếp tục.'**
  String get checkoutEmptyHelp;

  /// No description provided for @backToCart.
  ///
  /// In vi, this message translates to:
  /// **'Quay lại giỏ hàng'**
  String get backToCart;

  /// No description provided for @emptyOrders.
  ///
  /// In vi, this message translates to:
  /// **'Chưa có đơn hàng'**
  String get emptyOrders;

  /// No description provided for @noResults.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy kết quả'**
  String get noResults;

  /// No description provided for @error.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi'**
  String get error;

  /// No description provided for @retry.
  ///
  /// In vi, this message translates to:
  /// **'Thử lại'**
  String get retry;

  /// No description provided for @cancel.
  ///
  /// In vi, this message translates to:
  /// **'Hủy'**
  String get cancel;

  /// No description provided for @confirm.
  ///
  /// In vi, this message translates to:
  /// **'Xác nhận'**
  String get confirm;

  /// No description provided for @success.
  ///
  /// In vi, this message translates to:
  /// **'Thành công'**
  String get success;

  /// No description provided for @processing.
  ///
  /// In vi, this message translates to:
  /// **'Đang xử lý...'**
  String get processing;

  /// No description provided for @loading.
  ///
  /// In vi, this message translates to:
  /// **'Đang tải...'**
  String get loading;

  /// No description provided for @customerReviews.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá của khách hàng'**
  String get customerReviews;

  /// No description provided for @reviewSectionSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Điểm số và nhận xét từ những người đã mua sản phẩm này.'**
  String get reviewSectionSubtitle;

  /// No description provided for @reviewCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} đánh giá'**
  String reviewCount(int count);

  /// No description provided for @reviewRatingOption.
  ///
  /// In vi, this message translates to:
  /// **'{count} sao'**
  String reviewRatingOption(int count);

  /// No description provided for @reviewRatingBreakdown.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá {count} sao'**
  String reviewRatingBreakdown(int count);

  /// No description provided for @yourReview.
  ///
  /// In vi, this message translates to:
  /// **'Nội dung đánh giá'**
  String get yourReview;

  /// No description provided for @shareReviewExperience.
  ///
  /// In vi, this message translates to:
  /// **'Chia sẻ trải nghiệm về sản phẩm...'**
  String get shareReviewExperience;

  /// No description provided for @submitReview.
  ///
  /// In vi, this message translates to:
  /// **'Gửi đánh giá'**
  String get submitReview;

  /// No description provided for @submittingReview.
  ///
  /// In vi, this message translates to:
  /// **'Đang gửi...'**
  String get submittingReview;

  /// No description provided for @signInToReview.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập để chia sẻ trải nghiệm của bạn.'**
  String get signInToReview;

  /// No description provided for @signIn.
  ///
  /// In vi, this message translates to:
  /// **'Đăng nhập'**
  String get signIn;

  /// No description provided for @verifiedPurchase.
  ///
  /// In vi, this message translates to:
  /// **'Đã mua hàng'**
  String get verifiedPurchase;

  /// No description provided for @anonymousCustomer.
  ///
  /// In vi, this message translates to:
  /// **'Khách hàng'**
  String get anonymousCustomer;

  /// No description provided for @helpfulCount.
  ///
  /// In vi, this message translates to:
  /// **'Hữu ích ({count})'**
  String helpfulCount(int count);

  /// No description provided for @saving.
  ///
  /// In vi, this message translates to:
  /// **'Đang lưu...'**
  String get saving;

  /// No description provided for @noReviewsTitle.
  ///
  /// In vi, this message translates to:
  /// **'Hãy là người đầu tiên đánh giá sản phẩm này'**
  String get noReviewsTitle;

  /// No description provided for @noReviewsSubtitle.
  ///
  /// In vi, this message translates to:
  /// **'Chia sẻ trải nghiệm để giúp những người mua khác.'**
  String get noReviewsSubtitle;

  /// No description provided for @reviewsLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải đánh giá'**
  String get reviewsLoadError;

  /// No description provided for @reviewsLoadErrorHelp.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối và thử lại.'**
  String get reviewsLoadErrorHelp;

  /// No description provided for @tryAgain.
  ///
  /// In vi, this message translates to:
  /// **'Thử lại'**
  String get tryAgain;

  /// No description provided for @reviewPublished.
  ///
  /// In vi, this message translates to:
  /// **'Đã đăng'**
  String get reviewPublished;

  /// No description provided for @reviewPending.
  ///
  /// In vi, this message translates to:
  /// **'Đang chờ kiểm duyệt'**
  String get reviewPending;

  /// No description provided for @reviewRejected.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá không được đăng'**
  String get reviewRejected;

  /// No description provided for @reviewPublishedNotice.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá của bạn đã được đăng.'**
  String get reviewPublishedNotice;

  /// No description provided for @reviewPendingNotice.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá đã được gửi để kiểm duyệt.'**
  String get reviewPendingNotice;

  /// No description provided for @reviewRejectedNotice.
  ///
  /// In vi, this message translates to:
  /// **'Đánh giá của bạn không thể được đăng.'**
  String get reviewRejectedNotice;

  /// No description provided for @reviewSubmitError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể gửi đánh giá. Vui lòng thử lại.'**
  String get reviewSubmitError;

  /// No description provided for @reviewVoteError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể lưu lượt hữu ích. Vui lòng thử lại.'**
  String get reviewVoteError;

  /// No description provided for @reviewImageLabel.
  ///
  /// In vi, this message translates to:
  /// **'Hình ảnh đánh giá {count}'**
  String reviewImageLabel(int count);

  /// No description provided for @myOrders.
  ///
  /// In vi, this message translates to:
  /// **'Đơn hàng của tôi'**
  String get myOrders;

  /// No description provided for @orderDetailTitle.
  ///
  /// In vi, this message translates to:
  /// **'Chi tiết đơn hàng'**
  String get orderDetailTitle;

  /// No description provided for @orderAll.
  ///
  /// In vi, this message translates to:
  /// **'Tất cả'**
  String get orderAll;

  /// No description provided for @orderStatusPending.
  ///
  /// In vi, this message translates to:
  /// **'Chờ xác nhận'**
  String get orderStatusPending;

  /// No description provided for @orderStatusConfirmed.
  ///
  /// In vi, this message translates to:
  /// **'Đã xác nhận'**
  String get orderStatusConfirmed;

  /// No description provided for @orderStatusProcessing.
  ///
  /// In vi, this message translates to:
  /// **'Đang xử lý'**
  String get orderStatusProcessing;

  /// No description provided for @orderStatusShipped.
  ///
  /// In vi, this message translates to:
  /// **'Đang giao'**
  String get orderStatusShipped;

  /// No description provided for @orderStatusDelivered.
  ///
  /// In vi, this message translates to:
  /// **'Đã giao'**
  String get orderStatusDelivered;

  /// No description provided for @orderStatusCancelled.
  ///
  /// In vi, this message translates to:
  /// **'Đã hủy'**
  String get orderStatusCancelled;

  /// No description provided for @orderListCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} đơn hàng'**
  String orderListCount(int count);

  /// No description provided for @orderItemsCount.
  ///
  /// In vi, this message translates to:
  /// **'{count} sản phẩm'**
  String orderItemsCount(int count);

  /// No description provided for @orderEmptyHelp.
  ///
  /// In vi, this message translates to:
  /// **'Các đơn hàng bạn đặt sẽ xuất hiện tại đây để theo dõi.'**
  String get orderEmptyHelp;

  /// No description provided for @orderEmptyFilteredTitle.
  ///
  /// In vi, this message translates to:
  /// **'Không có đơn hàng ở trạng thái này'**
  String get orderEmptyFilteredTitle;

  /// No description provided for @orderEmptyFilteredHelp.
  ///
  /// In vi, this message translates to:
  /// **'Chọn trạng thái khác hoặc xem tất cả đơn hàng.'**
  String get orderEmptyFilteredHelp;

  /// No description provided for @ordersLoadError.
  ///
  /// In vi, this message translates to:
  /// **'Không thể tải đơn hàng'**
  String get ordersLoadError;

  /// No description provided for @orderNetworkError.
  ///
  /// In vi, this message translates to:
  /// **'Kiểm tra kết nối rồi thử lại.'**
  String get orderNetworkError;

  /// No description provided for @orderUnauthorizedError.
  ///
  /// In vi, this message translates to:
  /// **'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'**
  String get orderUnauthorizedError;

  /// No description provided for @orderForbiddenError.
  ///
  /// In vi, this message translates to:
  /// **'Bạn không có quyền xem đơn hàng này.'**
  String get orderForbiddenError;

  /// No description provided for @orderNotFoundError.
  ///
  /// In vi, this message translates to:
  /// **'Không tìm thấy đơn hàng này.'**
  String get orderNotFoundError;

  /// No description provided for @orderServerError.
  ///
  /// In vi, this message translates to:
  /// **'Dịch vụ đơn hàng đang gián đoạn. Vui lòng thử lại sau.'**
  String get orderServerError;

  /// No description provided for @orderRequestCancelledError.
  ///
  /// In vi, this message translates to:
  /// **'Yêu cầu đã bị hủy.'**
  String get orderRequestCancelledError;

  /// No description provided for @orderUnknownError.
  ///
  /// In vi, this message translates to:
  /// **'Đã xảy ra lỗi. Vui lòng thử lại.'**
  String get orderUnknownError;

  /// No description provided for @orderCancelledSuccess.
  ///
  /// In vi, this message translates to:
  /// **'Đã hủy đơn hàng'**
  String get orderCancelledSuccess;

  /// No description provided for @cancelOrder.
  ///
  /// In vi, this message translates to:
  /// **'Hủy đơn hàng'**
  String get cancelOrder;

  /// No description provided for @cancellingOrder.
  ///
  /// In vi, this message translates to:
  /// **'Đang hủy...'**
  String get cancellingOrder;

  /// No description provided for @cancelOrderTitle.
  ///
  /// In vi, this message translates to:
  /// **'Hủy đơn hàng này?'**
  String get cancelOrderTitle;

  /// No description provided for @cancelOrderConfirmation.
  ///
  /// In vi, this message translates to:
  /// **'Thao tác này không thể hoàn tác.'**
  String get cancelOrderConfirmation;

  /// No description provided for @keepOrder.
  ///
  /// In vi, this message translates to:
  /// **'Giữ đơn hàng'**
  String get keepOrder;

  /// No description provided for @confirmCancelOrder.
  ///
  /// In vi, this message translates to:
  /// **'Có, hủy đơn hàng'**
  String get confirmCancelOrder;

  /// No description provided for @orderStatusSection.
  ///
  /// In vi, this message translates to:
  /// **'Trạng thái đơn hàng'**
  String get orderStatusSection;

  /// No description provided for @deliveryAddress.
  ///
  /// In vi, this message translates to:
  /// **'Địa chỉ giao hàng'**
  String get deliveryAddress;

  /// No description provided for @orderProducts.
  ///
  /// In vi, this message translates to:
  /// **'Sản phẩm'**
  String get orderProducts;

  /// No description provided for @paymentInformation.
  ///
  /// In vi, this message translates to:
  /// **'Thanh toán'**
  String get paymentInformation;

  /// No description provided for @orderInformation.
  ///
  /// In vi, this message translates to:
  /// **'Thông tin đơn hàng'**
  String get orderInformation;

  /// No description provided for @orderCode.
  ///
  /// In vi, this message translates to:
  /// **'Mã đơn hàng'**
  String get orderCode;

  /// No description provided for @placedAt.
  ///
  /// In vi, this message translates to:
  /// **'Ngày đặt'**
  String get placedAt;

  /// No description provided for @updatedAt.
  ///
  /// In vi, this message translates to:
  /// **'Cập nhật gần nhất'**
  String get updatedAt;

  /// No description provided for @paymentMethod.
  ///
  /// In vi, this message translates to:
  /// **'Phương thức thanh toán'**
  String get paymentMethod;

  /// No description provided for @paymentStatus.
  ///
  /// In vi, this message translates to:
  /// **'Trạng thái thanh toán'**
  String get paymentStatus;

  /// No description provided for @paid.
  ///
  /// In vi, this message translates to:
  /// **'Đã thanh toán'**
  String get paid;

  /// No description provided for @unpaid.
  ///
  /// In vi, this message translates to:
  /// **'Chưa thanh toán'**
  String get unpaid;

  /// No description provided for @trackingNumber.
  ///
  /// In vi, this message translates to:
  /// **'Mã vận đơn'**
  String get trackingNumber;

  /// No description provided for @carrier.
  ///
  /// In vi, this message translates to:
  /// **'Đơn vị vận chuyển'**
  String get carrier;

  /// No description provided for @shippingMethod.
  ///
  /// In vi, this message translates to:
  /// **'Phương thức giao hàng'**
  String get shippingMethod;

  /// No description provided for @orderProductsUnavailable.
  ///
  /// In vi, this message translates to:
  /// **'Thông tin sản phẩm của đơn hàng này hiện không khả dụng.'**
  String get orderProductsUnavailable;

  /// No description provided for @quantityShort.
  ///
  /// In vi, this message translates to:
  /// **'SL {count}'**
  String quantityShort(int count);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'vi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'vi':
      return AppLocalizationsVi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
