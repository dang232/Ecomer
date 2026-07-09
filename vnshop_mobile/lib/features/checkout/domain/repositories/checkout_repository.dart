import '../../data/models/address_model.dart';
import '../../data/models/checkout_session.dart';
import '../../data/models/payment_transaction.dart';
import '../../data/models/shipping_quote.dart';

abstract class CheckoutRepository {
  /// Get available payment methods for the merchant
  List<PaymentMethod> getAvailablePaymentMethods();

  Future<List<VietnamAddress>> getAddresses();
  Future<VietnamAddress> addAddress(VietnamAddress address);
  Future<VietnamAddress> updateAddress(VietnamAddress address);
  Future<void> deleteAddress(String addressId);
  Future<void> setDefaultAddress(String addressId);

  Future<List<ShippingQuote>> getShippingQuotes(VietnamAddress address);
  Future<CheckoutSession> createSession({
    required String userId,
    required double subtotal,
    double discountAmount = 0,
    String? couponCode,
  });
  Future<CheckoutSession> updateSession(CheckoutSession session);
  Future<PaymentTransaction> initiatePayment({
    required CheckoutSession session,
    required PaymentMethod method,
    required String idempotencyKey,
  });
  Future<PaymentTransaction> getPaymentStatus(String transactionId);
  Future<PaymentTransaction> retryPayment({
    required String transactionId,
    required String newIdempotencyKey,
  });
  Future<String> createOrder({
    required CheckoutSession session,
    required PaymentTransaction transaction,
  });
  Future<void> cancelOrder(String orderId);
}
