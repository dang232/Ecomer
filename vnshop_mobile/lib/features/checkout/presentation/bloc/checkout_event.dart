import 'package:equatable/equatable.dart';

import '../../data/models/address_model.dart';
import '../../data/models/payment_transaction.dart';
import '../../data/models/shipping_quote.dart';

abstract class CheckoutEvent extends Equatable {
  const CheckoutEvent();

  @override
  List<Object?> get props => [];
}

class CheckoutStarted extends CheckoutEvent {
  final List<LineItemData> lineItems;
  final double subtotal;
  final double discountAmount;
  final String? couponCode;

  const CheckoutStarted({
    required this.lineItems,
    required this.subtotal,
    this.discountAmount = 0,
    this.couponCode,
  });

  @override
  List<Object?> get props => [lineItems, subtotal, discountAmount, couponCode];
}

/// Data class for line items passed from cart
class LineItemData {
  final String productId;
  final String? variantSku;
  final int quantity;

  const LineItemData({
    required this.productId,
    this.variantSku,
    required this.quantity,
  });
}

class CheckoutAddressesLoaded extends CheckoutEvent {
  const CheckoutAddressesLoaded();
}

class CheckoutAddressSelected extends CheckoutEvent {
  final VietnamAddress address;

  const CheckoutAddressSelected(this.address);

  @override
  List<Object?> get props => [address];
}

class CheckoutAddressAdded extends CheckoutEvent {
  final VietnamAddress address;

  const CheckoutAddressAdded(this.address);

  @override
  List<Object?> get props => [address];
}

class CheckoutAddressUpdated extends CheckoutEvent {
  final VietnamAddress address;

  const CheckoutAddressUpdated(this.address);

  @override
  List<Object?> get props => [address];
}

class CheckoutAddressDeleted extends CheckoutEvent {
  final String addressId;

  const CheckoutAddressDeleted(this.addressId);

  @override
  List<Object?> get props => [addressId];
}

class CheckoutShippingQuotesRequested extends CheckoutEvent {
  final VietnamAddress address;

  const CheckoutShippingQuotesRequested(this.address);

  @override
  List<Object?> get props => [address];
}

class CheckoutShippingSelected extends CheckoutEvent {
  final ShippingQuote shipping;

  const CheckoutShippingSelected(this.shipping);

  @override
  List<Object?> get props => [shipping];
}

class CheckoutPaymentMethodSelected extends CheckoutEvent {
  final PaymentMethod method;

  const CheckoutPaymentMethodSelected(this.method);

  @override
  List<Object?> get props => [method];
}

class CheckoutPaymentInitiated extends CheckoutEvent {
  const CheckoutPaymentInitiated();
}

class CheckoutPaymentStatusChecked extends CheckoutEvent {
  final String transactionId;

  const CheckoutPaymentStatusChecked(this.transactionId);

  @override
  List<Object?> get props => [transactionId];
}

class CheckoutOrderPlaced extends CheckoutEvent {
  const CheckoutOrderPlaced();
}

class CheckoutOrderCancelled extends CheckoutEvent {
  final String orderId;

  const CheckoutOrderCancelled(this.orderId);

  @override
  List<Object?> get props => [orderId];
}

class CheckoutReset extends CheckoutEvent {
  const CheckoutReset();
}
