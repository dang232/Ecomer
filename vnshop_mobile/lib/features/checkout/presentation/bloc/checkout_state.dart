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
  paymentSuccess,
  paymentFailed,
  orderPlaced,
  error,
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
  final String? errorMessage;
  final bool isLoadingAddresses;
  final bool isLoadingShipping;
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
    this.errorMessage,
    this.isLoadingAddresses = false,
    this.isLoadingShipping = false,
    this.isProcessingPayment = false,
  });

  double get subtotal => session?.subtotal ?? 0;
  double get shippingFee => selectedShipping?.price ?? 0;
  double get discountAmount => session?.discountAmount ?? 0;
  double get totalAmount => subtotal + shippingFee - discountAmount;

  bool get canPlaceOrder =>
      selectedAddress != null &&
      selectedShipping != null &&
      selectedPaymentMethod != null;

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
    String? errorMessage,
    bool? isLoadingAddresses,
    bool? isLoadingShipping,
    bool? isProcessingPayment,
    bool clearSelectedAddress = false,
  }) {
    return CheckoutState(
      status: status ?? this.status,
      session: session ?? this.session,
      addresses: addresses ?? this.addresses,
      selectedAddress: clearSelectedAddress ? null : (selectedAddress ?? this.selectedAddress),
      shippingQuotes: shippingQuotes ?? this.shippingQuotes,
      selectedShipping: selectedShipping ?? this.selectedShipping,
      selectedPaymentMethod: selectedPaymentMethod ?? this.selectedPaymentMethod,
      currentTransaction: currentTransaction ?? this.currentTransaction,
      orderId: orderId ?? this.orderId,
      errorMessage: errorMessage ?? this.errorMessage,
      isLoadingAddresses: isLoadingAddresses ?? this.isLoadingAddresses,
      isLoadingShipping: isLoadingShipping ?? this.isLoadingShipping,
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
        errorMessage,
        isLoadingAddresses,
        isLoadingShipping,
        isProcessingPayment,
      ];
}
