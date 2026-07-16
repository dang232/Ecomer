import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';
import 'package:vnshop_mobile/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_state.dart';

class MockCheckoutRepository extends Mock implements CheckoutRepository {}

void main() {
  late MockCheckoutRepository repository;

  setUp(() {
    repository = MockCheckoutRepository();
  });

  blocTest<CheckoutBloc, CheckoutState>(
    'loads enabled payment methods into checkout state',
    build: () {
      when(repository.getAvailablePaymentMethods).thenAnswer(
        (_) async => const [PaymentMethod.cod, PaymentMethod.vietqr],
      );
      return CheckoutBloc(repository: repository);
    },
    act: (bloc) => bloc.add(const CheckoutPaymentMethodsRequested()),
    expect: () => [
      isA<CheckoutState>().having(
        (state) => state.isLoadingPaymentMethods,
        'isLoadingPaymentMethods',
        isTrue,
      ),
      isA<CheckoutState>()
          .having(
            (state) => state.isLoadingPaymentMethods,
            'isLoadingPaymentMethods',
            isFalse,
          )
          .having(
            (state) => state.availablePaymentMethods,
            'availablePaymentMethods',
            [PaymentMethod.cod, PaymentMethod.vietqr],
          ),
    ],
  );

  blocTest<CheckoutBloc, CheckoutState>(
    'rejects a payment method that the backend did not enable',
    build: () => CheckoutBloc(repository: repository),
    seed: () =>
        const CheckoutState(availablePaymentMethods: [PaymentMethod.cod]),
    act: (bloc) =>
        bloc.add(const CheckoutPaymentMethodSelected(PaymentMethod.momo)),
    expect: () => [
      isA<CheckoutState>()
          .having(
            (state) => state.selectedPaymentMethod,
            'selectedPaymentMethod',
            isNull,
          )
          .having(
            (state) => state.failure,
            'failure',
            CheckoutFailure.paymentMethodUnavailable,
          ),
    ],
  );
}
