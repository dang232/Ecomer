import 'package:equatable/equatable.dart';

import '../../data/models/address_model.dart';
import '../../data/models/checkout_session.dart';
import '../../data/models/payment_transaction.dart';
import '../../data/models/shipping_quote.dart';

enum CheckoutStatus {
  initial,
  loading,
  addressesLoaded,
  shippingQuotesLoaded,
  ready,
  processingPayment,
  awaitingPayment,
  paymentSuccess,
  paymentFailed,
  orderPlaced,
  error,
}

enum CheckoutFailure {
  initialize,
  loadAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  loadShipping,
  loadPaymentMethods,
  paymentMethodUnavailable,
  incomplete,
  updateSession,
  initiatePayment,
  paymentStatus,
  paymentFailed,
  transactionMissing,
  createOrder,
  cancelOrder,
}

class CheckoutState extends Equatable {
  final CheckoutStatus status;
  final CheckoutSession? session;
  final List<VietnamAddress> addresses;
  final VietnamAddress? selectedAddress;
  final List<ShippingQuote> shippingQuotes;
  final ShippingQuote? selectedShipping;
  final PaymentMethod? selectedPaymentMethod;
  final PaymentTransaction? currentTransaction;
  final String? orderId;
  final bool isLoadingAddresses;
  final bool isLoadingShipping;
  final List<PaymentMethod> availablePaymentMethods;
  final bool isLoadingPaymentMethods;
  final CheckoutFailure? failure;
  final bool isProcessingPayment;

  const CheckoutState({
    this.status = CheckoutStatus.initial,
    this.session,
    this.addresses = const [],
    this.selectedAddress,
    this.shippingQuotes = const [],
    this.selectedShipping,
    this.selectedPaymentMethod,
    this.currentTransaction,
    this.orderId,
    this.isLoadingAddresses = false,
    this.isLoadingShipping = false,
    this.availablePaymentMethods = const [],
    this.isLoadingPaymentMethods = false,
    this.failure,
    this.isProcessingPayment = false,
  });

  double get subtotal => session?.subtotal ?? 0;
  double get shippingFee => selectedShipping?.price ?? 0;
  double get discountAmount => session?.discountAmount ?? 0;
  double get totalAmount => subtotal + shippingFee - discountAmount;

  bool get canPlaceOrder =>
      selectedAddress != null &&
      selectedShipping != null &&
      selectedPaymentMethod != null &&
      availablePaymentMethods.contains(selectedPaymentMethod);

  bool get hasCompletedPayment =>
      currentTransaction?.status == PaymentStatus.completed;

  CheckoutState copyWith({
    CheckoutStatus? status,
    CheckoutSession? session,
    List<VietnamAddress>? addresses,
    VietnamAddress? selectedAddress,
    List<ShippingQuote>? shippingQuotes,
    ShippingQuote? selectedShipping,
    PaymentMethod? selectedPaymentMethod,
    PaymentTransaction? currentTransaction,
    String? orderId,
    bool? isLoadingAddresses,
    bool? isLoadingShipping,
    List<PaymentMethod>? availablePaymentMethods,
    bool? isLoadingPaymentMethods,
    CheckoutFailure? failure,
    bool clearFailure = false,
    bool? isProcessingPayment,
    bool clearSelectedAddress = false,
    bool clearSelectedShipping = false,
    bool clearSelectedPaymentMethod = false,
  }) {
    return CheckoutState(
      status: status ?? this.status,
      session: session ?? this.session,
      addresses: addresses ?? this.addresses,
      selectedAddress: clearSelectedAddress
          ? null
          : (selectedAddress ?? this.selectedAddress),
      shippingQuotes: shippingQuotes ?? this.shippingQuotes,
      selectedShipping: clearSelectedShipping
          ? null
          : selectedShipping ?? this.selectedShipping,
      selectedPaymentMethod: clearSelectedPaymentMethod
          ? null
          : selectedPaymentMethod ?? this.selectedPaymentMethod,
      currentTransaction: currentTransaction ?? this.currentTransaction,
      orderId: orderId ?? this.orderId,
      isLoadingAddresses: isLoadingAddresses ?? this.isLoadingAddresses,
      isLoadingShipping: isLoadingShipping ?? this.isLoadingShipping,
      availablePaymentMethods:
          availablePaymentMethods ?? this.availablePaymentMethods,
      isLoadingPaymentMethods:
          isLoadingPaymentMethods ?? this.isLoadingPaymentMethods,
      failure: clearFailure ? null : failure ?? this.failure,
      isProcessingPayment: isProcessingPayment ?? this.isProcessingPayment,
    );
  }

  @override
  List<Object?> get props => [
    status,
    session,
    addresses,
    selectedAddress,
    shippingQuotes,
    selectedShipping,
    selectedPaymentMethod,
    currentTransaction,
    orderId,
    isLoadingAddresses,
    isLoadingShipping,
    availablePaymentMethods,
    isLoadingPaymentMethods,
    failure,
    isProcessingPayment,
  ];
}
