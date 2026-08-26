import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/checkout/data/models/checkout_session.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';
import 'package:vnshop_mobile/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_state.dart';

class IdentityCheckoutRepository extends Mock implements CheckoutRepository {}

void main() {
  test('CheckoutBloc creates a session for the authenticated user', () async {
    final repository = IdentityCheckoutRepository();
    final session = CheckoutSession.create(
      userId: 'buyer-42',
      lineItems: const [LineItem(productId: 'product-1', quantity: 1)],
      subtotal: 100000,
    );
    when(
      () => repository.createSession(
        userId: 'buyer-42',
        lineItems: any(named: 'lineItems'),
        subtotal: 100000,
        discountAmount: 0,
        couponCode: null,
      ),
    ).thenAnswer((_) async => session);
    when(repository.getAddresses).thenAnswer((_) async => const []);
    when(repository.getAvailablePaymentMethods).thenAnswer(
      (_) async => const [PaymentMethod.cod],
    );

    final bloc = CheckoutBloc(repository: repository, userId: 'buyer-42');
    bloc.add(
      const CheckoutStarted(
        lineItems: [LineItemData(productId: 'product-1', quantity: 1)],
        subtotal: 100000,
      ),
    );
    await bloc.stream.firstWhere((state) => state.session != null);

    verify(
      () => repository.createSession(
        userId: 'buyer-42',
        lineItems: any(named: 'lineItems'),
        subtotal: 100000,
        discountAmount: 0,
        couponCode: null,
      ),
    ).called(1);
    expect(bloc.state.session?.userId, 'buyer-42');
    await bloc.close();
  });

  blocTest<CheckoutBloc, CheckoutState>(
    'does not create a session without an authenticated user id',
    build: () => CheckoutBloc(repository: IdentityCheckoutRepository()),
    act: (bloc) => bloc.add(
      const CheckoutStarted(
        lineItems: [LineItemData(productId: 'product-1', quantity: 1)],
        subtotal: 100000,
      ),
    ),
    expect: () => [
      isA<CheckoutState>().having(
        (state) => state.status,
        'status',
        CheckoutStatus.loading,
      ),
      isA<CheckoutState>().having(
        (state) => state.failure,
        'failure',
        CheckoutFailure.initialize,
      ),
    ],
  );
}
