// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'VNShop';

  @override
  String get home => 'Home';

  @override
  String get products => 'Products';

  @override
  String get browseProducts => 'Browse products';

  @override
  String get allCategories => 'All';

  @override
  String productsFound(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count products',
      one: '1 product',
    );
    return '$_temp0';
  }

  @override
  String get notifications => 'Notifications';

  @override
  String get favorites => 'Favorites';

  @override
  String favoritesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count saved products',
      one: '1 saved product',
    );
    return '$_temp0';
  }

  @override
  String get noFavoritesTitle => 'No favorites yet';

  @override
  String get noFavoritesSubtitle => 'Save products to find them quickly here.';

  @override
  String get favoritesLoadError => 'Favorites couldn\'t be loaded';

  @override
  String get favoritesLoadHelp => 'Check your connection and try again.';

  @override
  String get someFavoritesLoadError =>
      'Some saved products couldn\'t be loaded.';

  @override
  String get refresh => 'Refresh';

  @override
  String get homeProductsLoadError => 'Products couldn\'t be loaded';

  @override
  String get homeProductsLoadHelp => 'Check your connection and try again.';

  @override
  String get noProductsTitle => 'No products found';

  @override
  String get noProductsSubtitle => 'Try another search or category.';

  @override
  String get filters => 'Filters';

  @override
  String get sortProducts => 'Sort products';

  @override
  String get clearFilters => 'Clear filters';

  @override
  String get resetFilters => 'Reset';

  @override
  String get applyFilters => 'Apply filters';

  @override
  String get minimumPrice => 'Minimum price';

  @override
  String get maximumPrice => 'Maximum price';

  @override
  String get invalidPrice => 'Enter a valid price.';

  @override
  String get invalidPriceRange => 'Minimum price cannot exceed maximum price.';

  @override
  String get sameDayOnly => 'Same-day delivery only';

  @override
  String get verifiedProductsOnly => 'Verified products only';

  @override
  String get officialStoresOnly => 'Official stores only';

  @override
  String get sortNewest => 'Newest';

  @override
  String get sortPriceLowToHigh => 'Price: Low to high';

  @override
  String get sortPriceHighToLow => 'Price: High to low';

  @override
  String get someProductsLoadError =>
      'New results couldn\'t be loaded. Showing the previous products.';

  @override
  String get cart => 'Cart';

  @override
  String get orders => 'Orders';

  @override
  String get profile => 'Profile';

  @override
  String get login => 'Login';

  @override
  String get register => 'Register';

  @override
  String get logout => 'Logout';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get phone => 'Phone';

  @override
  String get searchProducts => 'Search products…';

  @override
  String get clearSearch => 'Clear search';

  @override
  String get addToCart => 'Add to cart';

  @override
  String get buyNow => 'Buy now';

  @override
  String get viewCart => 'View cart';

  @override
  String itemsAddedToCart(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items added to your cart',
      one: '1 item added to your cart',
    );
    return '$_temp0';
  }

  @override
  String get copyProductLink => 'Copy product link';

  @override
  String get productLinkCopied => 'Product link copied';

  @override
  String get addToFavorites => 'Add to favorites';

  @override
  String get removeFromFavorites => 'Remove from favorites';

  @override
  String get addedToFavorites => 'Added to favorites';

  @override
  String get removedFromFavorites => 'Removed from favorites';

  @override
  String get wishlistUpdateError => 'Couldn\'t update favorites. Try again.';

  @override
  String get quantity => 'Quantity';

  @override
  String quantityValue(int count) {
    return 'Quantity: $count';
  }

  @override
  String get decreaseQuantity => 'Decrease quantity';

  @override
  String get increaseQuantity => 'Increase quantity';

  @override
  String get inStock => 'In stock';

  @override
  String lowStock(int count) {
    return 'Only $count left';
  }

  @override
  String get outOfStock => 'Out of stock';

  @override
  String get productDescription => 'Product description';

  @override
  String get noProductDescription =>
      'No description is available for this product.';

  @override
  String get expandDescription => 'Show full description';

  @override
  String get collapseDescription => 'Collapse description';

  @override
  String get checkout => 'Checkout';

  @override
  String get checkoutDeliveryAddress => 'Delivery address';

  @override
  String get checkoutDeliveryMethod => 'Delivery method';

  @override
  String get checkoutPaymentMethod => 'Payment method';

  @override
  String get checkoutReviewOrder => 'Review order';

  @override
  String get defaultLabel => 'Default';

  @override
  String get edit => 'Edit';

  @override
  String get addNewAddress => 'Add new address';

  @override
  String get editAddressTitle => 'Edit address';

  @override
  String get addressDetails => 'Address details';

  @override
  String get streetAddressLabel => 'Street address';

  @override
  String get streetAddressHint => 'House number and street name';

  @override
  String get wardLabel => 'Ward / Commune';

  @override
  String get wardHint => 'Optional';

  @override
  String get districtLabel => 'District';

  @override
  String get districtHint => 'Enter district';

  @override
  String get cityProvinceLabel => 'City / Province';

  @override
  String get cityProvinceHint => 'Enter city or province';

  @override
  String requiredField(String field) {
    return '$field is required';
  }

  @override
  String get saveAddress => 'Save address';

  @override
  String get setDefaultAddress => 'Set as default address';

  @override
  String get defaultAddressHelp => 'Use this address first on future orders.';

  @override
  String get addressNotFoundTitle => 'Address not found';

  @override
  String get addressNotFoundHelp =>
      'This address may have been removed. Return to checkout and choose another one.';

  @override
  String get addressAddedSuccess => 'Address added';

  @override
  String get addressUpdatedSuccess => 'Address updated';

  @override
  String get discardAddressTitle => 'Discard changes?';

  @override
  String get discardAddressHelp => 'Your unsaved address changes will be lost.';

  @override
  String get discardChanges => 'Discard';

  @override
  String get noAddressTitle => 'Add a delivery address';

  @override
  String get noAddressHelp =>
      'An address is required before delivery options can be calculated.';

  @override
  String get deleteAddress => 'Delete address';

  @override
  String deleteAddressConfirmation(String name) {
    return 'Delete the address for $name?';
  }

  @override
  String get selectAddressFirst => 'Choose a delivery address first.';

  @override
  String get shippingMethodsLoadError => 'Delivery methods couldn\'t be loaded';

  @override
  String get noShippingMethods =>
      'No delivery methods are available for this address.';

  @override
  String get deliveryToday => 'Delivery today';

  @override
  String deliveryDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Delivery in $count days',
      one: 'Delivery in 1 day',
    );
    return '$_temp0';
  }

  @override
  String get free => 'Free';

  @override
  String get paymentMethodsLoadError => 'Payment methods couldn\'t be loaded';

  @override
  String get noPaymentMethods => 'No payment methods are currently available.';

  @override
  String get paymentCodName => 'Cash on delivery';

  @override
  String get paymentCodDescription => 'Pay when your order arrives';

  @override
  String get paymentVietqrName => 'VietQR';

  @override
  String get paymentVietqrDescription => 'Scan a QR code with your banking app';

  @override
  String get paymentVnpayName => 'VNPay';

  @override
  String get paymentVnpayDescription => 'Pay through the VNPay gateway';

  @override
  String get paymentMomoName => 'MoMo';

  @override
  String get paymentMomoDescription => 'Pay with your MoMo wallet';

  @override
  String get paymentBankTransferName => 'Bank transfer';

  @override
  String get paymentBankTransferDescription =>
      'Transfer from your bank account';

  @override
  String get payNow => 'Pay now';

  @override
  String get orderPlacedTitle => 'Order placed';

  @override
  String get orderPlacedHelp =>
      'Your order has been received and is ready to track.';

  @override
  String orderNumber(String id) {
    return 'Order $id';
  }

  @override
  String get viewOrders => 'View orders';

  @override
  String get continueShopping => 'Continue shopping';

  @override
  String get completePayment => 'Complete payment';

  @override
  String get paymentQrInstruction =>
      'Scan this QR code in your banking app, then check the payment status.';

  @override
  String get openPaymentApp => 'Open payment app';

  @override
  String get checkPaymentStatus => 'Check payment status';

  @override
  String get paymentQrCode => 'Payment QR code';

  @override
  String get checkoutInitializeError =>
      'Checkout couldn\'t be started. Return to your cart and try again.';

  @override
  String get checkoutAddressesLoadError => 'Addresses couldn\'t be loaded.';

  @override
  String get checkoutAddressAddError => 'The address couldn\'t be added.';

  @override
  String get checkoutAddressUpdateError => 'The address couldn\'t be updated.';

  @override
  String get checkoutAddressDeleteError => 'The address couldn\'t be deleted.';

  @override
  String get checkoutPaymentUnavailable =>
      'That payment method is no longer available.';

  @override
  String get checkoutIncompleteError =>
      'Choose an address, delivery method, and payment method first.';

  @override
  String get checkoutUpdateError => 'Checkout totals couldn\'t be updated.';

  @override
  String get checkoutPaymentStartError =>
      'Payment couldn\'t be started. Try again.';

  @override
  String get checkoutPaymentStatusError =>
      'Payment status couldn\'t be refreshed.';

  @override
  String get checkoutPaymentFailed =>
      'Payment was not completed. Try another method or try again.';

  @override
  String get checkoutTransactionMissing =>
      'The payment transaction couldn\'t be found.';

  @override
  String get checkoutOrderCreateError =>
      'The order couldn\'t be created. Try again.';

  @override
  String get checkoutOrderCancelError => 'The order couldn\'t be cancelled.';

  @override
  String get placeOrder => 'Place order';

  @override
  String get total => 'Total';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get shipping => 'Shipping';

  @override
  String get discount => 'Discount';

  @override
  String get emptyCart => 'Cart is empty';

  @override
  String cartItemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String cartSelectionCount(int selected, int total) {
    return '$selected of $total selected';
  }

  @override
  String get selectAll => 'Select all';

  @override
  String get clearCart => 'Clear cart';

  @override
  String get clearCartConfirmation => 'Remove every item from your cart?';

  @override
  String get clearAll => 'Clear all';

  @override
  String get emptyCartHelp => 'Products you add will appear here.';

  @override
  String get shopNow => 'Shop now';

  @override
  String get cartLoadError => 'We couldn\'t load your cart';

  @override
  String get cartLoadErrorHelp => 'Check your connection and try again.';

  @override
  String get cartAddError => 'Couldn\'t add that item. Try again.';

  @override
  String get cartRemoveError => 'Couldn\'t remove that item. Try again.';

  @override
  String get cartQuantityError => 'Couldn\'t update the quantity. Try again.';

  @override
  String get cartInvalidCoupon => 'That coupon is unavailable or invalid.';

  @override
  String get cartRemoveCouponError => 'Couldn\'t remove the coupon. Try again.';

  @override
  String get cartClearError => 'Couldn\'t clear your cart. Try again.';

  @override
  String get cartSyncError => 'Your cart couldn\'t be synced. Try again.';

  @override
  String get cartCheckoutCleanupError =>
      'Your order was placed, but the cart couldn\'t be refreshed.';

  @override
  String get removeCartItem => 'Remove item';

  @override
  String removeCartItemConfirmation(String name) {
    return 'Remove $name from your cart?';
  }

  @override
  String get remove => 'Remove';

  @override
  String get couponTitle => 'Coupon';

  @override
  String get couponHint => 'Enter coupon code';

  @override
  String get applyCoupon => 'Apply';

  @override
  String get couponApplied => 'Applied';

  @override
  String couponAppliedCode(String code) {
    return 'Code: $code';
  }

  @override
  String get orderSummary => 'Order summary';

  @override
  String get selectedSubtotal => 'Selected subtotal';

  @override
  String get shippingCalculatedAtCheckout => 'Calculated at checkout';

  @override
  String get estimatedTotal => 'Estimated total';

  @override
  String get vatIncluded => 'VAT included where applicable';

  @override
  String get discountRecalculatedAtCheckout =>
      'Promotions are recalculated for the selected items at checkout.';

  @override
  String checkoutItemCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Checkout ($count)',
      one: 'Checkout (1)',
    );
    return '$_temp0';
  }

  @override
  String get checkoutEmptyTitle => 'No items selected';

  @override
  String get checkoutEmptyHelp =>
      'Return to your cart and choose at least one item to continue.';

  @override
  String get backToCart => 'Back to cart';

  @override
  String get emptyOrders => 'No orders yet';

  @override
  String get noResults => 'No results found';

  @override
  String get error => 'An error occurred';

  @override
  String get retry => 'Retry';

  @override
  String get cancel => 'Cancel';

  @override
  String get confirm => 'Confirm';

  @override
  String get success => 'Success';

  @override
  String get processing => 'Processing...';

  @override
  String get loading => 'Loading...';

  @override
  String get customerReviews => 'Customer reviews';

  @override
  String get reviewSectionSubtitle =>
      'Ratings and feedback from shoppers who bought this product.';

  @override
  String reviewCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count reviews',
      one: '1 review',
      zero: 'No reviews',
    );
    return '$_temp0';
  }

  @override
  String reviewRatingOption(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count stars',
      one: '1 star',
    );
    return '$_temp0';
  }

  @override
  String reviewRatingBreakdown(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count-star reviews',
      one: '1-star reviews',
    );
    return '$_temp0';
  }

  @override
  String get yourReview => 'Your review';

  @override
  String get shareReviewExperience =>
      'Share your experience with this product...';

  @override
  String get submitReview => 'Submit review';

  @override
  String get submittingReview => 'Submitting...';

  @override
  String get signInToReview => 'Sign in to share your experience.';

  @override
  String get signIn => 'Sign in';

  @override
  String get verifiedPurchase => 'Verified purchase';

  @override
  String get anonymousCustomer => 'Customer';

  @override
  String helpfulCount(int count) {
    return 'Helpful ($count)';
  }

  @override
  String get saving => 'Saving...';

  @override
  String get noReviewsTitle => 'Be the first to review this product';

  @override
  String get noReviewsSubtitle =>
      'Share your experience to help other shoppers.';

  @override
  String get reviewsLoadError => 'Reviews could not be loaded';

  @override
  String get reviewsLoadErrorHelp => 'Check your connection and try again.';

  @override
  String get tryAgain => 'Try again';

  @override
  String get reviewPublished => 'Published';

  @override
  String get reviewPending => 'Waiting for moderation';

  @override
  String get reviewRejected => 'Review not published';

  @override
  String get reviewPublishedNotice => 'Your review is now published.';

  @override
  String get reviewPendingNotice => 'Your review was submitted for moderation.';

  @override
  String get reviewRejectedNotice => 'Your review could not be published.';

  @override
  String get reviewSubmitError => 'Couldn\'t submit review. Try again.';

  @override
  String get reviewVoteError => 'Couldn\'t save your vote. Try again.';

  @override
  String reviewImageLabel(int count) {
    return 'Review image $count';
  }

  @override
  String get myOrders => 'My orders';

  @override
  String get orderDetailTitle => 'Order details';

  @override
  String get orderAll => 'All';

  @override
  String get orderStatusPending => 'Pending';

  @override
  String get orderStatusConfirmed => 'Confirmed';

  @override
  String get orderStatusProcessing => 'Processing';

  @override
  String get orderStatusShipped => 'Shipping';

  @override
  String get orderStatusDelivered => 'Delivered';

  @override
  String get orderStatusCancelled => 'Cancelled';

  @override
  String orderListCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
      zero: 'No orders',
    );
    return '$_temp0';
  }

  @override
  String orderItemsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String get orderEmptyHelp =>
      'Orders you place will appear here for tracking.';

  @override
  String get orderEmptyFilteredTitle => 'No orders in this status';

  @override
  String get orderEmptyFilteredHelp =>
      'Choose another status or browse all orders.';

  @override
  String get ordersLoadError => 'Orders couldn\'t be loaded';

  @override
  String get orderNetworkError => 'Check your connection and try again.';

  @override
  String get orderUnauthorizedError =>
      'Your session has expired. Sign in again.';

  @override
  String get orderForbiddenError => 'You don\'t have access to this order.';

  @override
  String get orderNotFoundError => 'This order could not be found.';

  @override
  String get orderServerError =>
      'The order service is unavailable. Try again shortly.';

  @override
  String get orderRequestCancelledError => 'The request was cancelled.';

  @override
  String get orderUnknownError => 'Something went wrong. Try again.';

  @override
  String get orderCancelledSuccess => 'Order cancelled';

  @override
  String get cancelOrder => 'Cancel order';

  @override
  String get cancellingOrder => 'Cancelling...';

  @override
  String get cancelOrderTitle => 'Cancel this order?';

  @override
  String get cancelOrderConfirmation => 'This action cannot be undone.';

  @override
  String get keepOrder => 'Keep order';

  @override
  String get confirmCancelOrder => 'Yes, cancel order';

  @override
  String get orderStatusSection => 'Order status';

  @override
  String get deliveryAddress => 'Delivery address';

  @override
  String get orderProducts => 'Products';

  @override
  String get paymentInformation => 'Payment';

  @override
  String get orderInformation => 'Order information';

  @override
  String get orderCode => 'Order code';

  @override
  String get placedAt => 'Placed';

  @override
  String get updatedAt => 'Last updated';

  @override
  String get paymentMethod => 'Payment method';

  @override
  String get paymentStatus => 'Payment status';

  @override
  String get paid => 'Paid';

  @override
  String get unpaid => 'Not paid';

  @override
  String get trackingNumber => 'Tracking number';

  @override
  String get carrier => 'Carrier';

  @override
  String get shippingMethod => 'Delivery method';

  @override
  String get orderProductsUnavailable =>
      'Product details are unavailable for this order.';

  @override
  String quantityShort(int count) {
    return 'Qty $count';
  }
}
