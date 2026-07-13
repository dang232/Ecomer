import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/cart/data/models/cart_model.dart';
import 'package:vnshop_mobile/features/checkout/data/models/address_model.dart';
import 'package:vnshop_mobile/features/checkout/data/models/checkout_session.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';

void main() {
  group('backend contract models', () {
    test('maps the checkout breakdown response fields', () {
      final session = CheckoutSession.fromBreakdown(
        userId: 'buyer-1',
        lineItems: const [LineItem(productId: 'product-1', quantity: 2)],
        subtotalFallback: 1,
        discountFallback: 2,
        breakdown: const {
          'itemsTotal': 200000,
          'shippingEstimate': 25000,
          'discount': 10000,
          'finalAmount': 215000,
        },
      );

      expect(session.subtotal, 200000);
      expect(session.shippingFee, 25000);
      expect(session.discountAmount, 10000);
      expect(session.totalAmount, 215000);
    });

    test('maps the nested VietQR payment response', () {
      final transaction = PaymentTransaction.fromApiResponse(const {
        'data': {
          'payment': {
            'paymentId': 'payment-1',
            'orderId': 'order-1',
            'method': 'VIETQR',
            'status': 'PENDING',
            'amount': 215000,
            'transactionRef': 'ref-1',
          },
          'qrImageUrl': 'https://example.test/qr.png',
        },
      });

      expect(transaction.id, 'payment-1');
      expect(transaction.orderId, 'order-1');
      expect(transaction.method, PaymentMethod.vietqr);
      expect(transaction.qrCodeUrl, 'https://example.test/qr.png');
      expect(transaction.transactionRef, 'ref-1');
    });

    test('maps the backend cart item shape', () {
      final cart = CartModel.fromJson(const {
        'id': 'cart-1',
        'userId': 'buyer-1',
        'items': [
          {
            'productId': 'product-1',
            'variantId': 'variant-red',
            'productName': 'Red shirt',
            'productImage': 'https://example.test/shirt.png',
            'unitPrice': {'amount': 125000, 'currency': 'VND'},
            'quantity': 2,
            'subtotal': {'amount': 250000, 'currency': 'VND'},
          },
        ],
      });

      final item = cart.items.single;
      expect(item.cartItemId, 'product-1:variant-red');
      expect(item.name, 'Red shirt');
      expect(item.imageUrl, 'https://example.test/shirt.png');
      expect(item.price, 125000);
      expect(item.sku, 'variant-red');
      expect(item.quantity, 2);
    });

    test('maps a backend address with profile metadata', () {
      final address = VietnamAddress.fromBackendJson(
        const {
          'street': '12 Nguyen Hue',
          'ward': 'Ben Nghe',
          'district': 'District 1',
          'city': 'Ho Chi Minh City',
          'isDefault': true,
        },
        index: 0,
        recipientName: 'Test User',
        phoneNumber: '0900000000',
      );

      expect(address.id, '0');
      expect(address.recipientName, 'Test User');
      expect(address.phoneNumber, '0900000000');
      expect(address.streetAddress, '12 Nguyen Hue');
      expect(address.isDefault, isTrue);
    });
  });
}
