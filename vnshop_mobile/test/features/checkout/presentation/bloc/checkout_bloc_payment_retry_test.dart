import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/checkout/data/models/address_model.dart';
import 'package:vnshop_mobile/features/checkout/data/models/checkout_session.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';
import 'package:vnshop_mobile/features/checkout/data/models/shipping_quote.dart';
import 'package:vnshop_mobile/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_state.dart';

class MockCheckoutRepository extends Mock implements CheckoutRepository {}

void main() {
  late MockCheckoutRepository repository;

  const address = VietnamAddress(
    id: 'address-1',
    recipientName: 'Buyer',
    phoneNumber: '0900000000',
    streetAddress: '1 Checkout Street',
    ward: 'Ward 1',
    district: 'District 1',
    city: 'Ho Chi Minh City',
  );
  const shipping = ShippingQuote(
    id: 'shipping-1',
    name: 'Standard',
    description: 'Tracked delivery',
    price: 30000,
    estimatedDays: 2,
    provider: ShippingProvider.giaoHangNhanh,
  );
  final session = CheckoutSession(
    sessionId: 'checkout-session',
    idempotencyKey: 'checkout-key',
    userId: 'buyer-1',
    lineItems: const [LineItem(productId: 'product-1', quantity: 1)],
    selectedAddress: address,
    selectedShipping: shipping,
    selectedPaymentMethod: PaymentMethod.vietqr.name,
    subtotal: 500000,
    shippingFee: 30000,
    discountAmount: 0,
    totalAmount: 530000,
    createdAt: DateTime(2026),
  );
  final fallbackTransaction = PaymentTransaction(
    id: '',
    orderId: '',
    idempotencyKey: 'fallback',
    method: PaymentMethod.vietqr,
    status: PaymentStatus.pending,
    amount: 530000,
    createdAt: DateTime(2026),
  );

  setUpAll(() {
    registerFallbackValue(session);
    registerFallbackValue(fallbackTransaction);
  });

  setUp(() {
    repository = MockCheckoutRepository();
  });

  blocTest<CheckoutBloc, CheckoutState>(
    'retries online payment without creating a second order',
    build: () {
      var paymentAttempts = 0;
      when(
        () => repository.createOrder(
          session: any(named: 'session'),
          transaction: any(named: 'transaction'),
          idempotencyKey: any(named: 'idempotencyKey'),
        ),
      ).thenAnswer((_) async => 'order-1');
      when(
        () => repository.initiatePayment(
          session: any(named: 'session'),
          method: PaymentMethod.vietqr,
          idempotencyKey: any(named: 'idempotencyKey'),
        ),
      ).thenAnswer((invocation) async {
        paymentAttempts++;
        if (paymentAttempts == 1) throw Exception('provider unavailable');
        return PaymentTransaction(
          id: 'payment-1',
          orderId: 'order-1',
          idempotencyKey: invocation.namedArguments[#idempotencyKey] as String,
          method: PaymentMethod.vietqr,
          status: PaymentStatus.pending,
          amount: 530000,
          createdAt: DateTime(2026),
        );
      });
      return CheckoutBloc(repository: repository);
    },
    seed: () => CheckoutState(
      status: CheckoutStatus.ready,
      session: session,
      addresses: const [address],
      selectedAddress: address,
      shippingQuotes: const [shipping],
      selectedShipping: shipping,
      availablePaymentMethods: const [PaymentMethod.vietqr],
      selectedPaymentMethod: PaymentMethod.vietqr,
    ),
    act: (bloc) async {
      final firstFailure = bloc.stream.firstWhere(
        (state) => state.status == CheckoutStatus.paymentFailed,
      );
      bloc.add(const CheckoutPaymentInitiated());
      await firstFailure;

      final awaitingPayment = bloc.stream.firstWhere(
        (state) => state.status == CheckoutStatus.awaitingPayment,
      );
      bloc.add(const CheckoutPaymentInitiated());
      await awaitingPayment;
    },
    verify: (bloc) {
      verify(
        () => repository.createOrder(
          session: any(named: 'session'),
          transaction: any(named: 'transaction'),
          idempotencyKey: any(named: 'idempotencyKey'),
        ),
      ).called(1);
      expect(bloc.state.orderId, 'order-1');
      expect(bloc.state.status, CheckoutStatus.awaitingPayment);
    },
  );
}
