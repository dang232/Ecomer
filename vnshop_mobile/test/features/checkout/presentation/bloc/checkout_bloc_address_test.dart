import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/checkout/data/models/address_model.dart';
import 'package:vnshop_mobile/features/checkout/data/models/shipping_quote.dart';
import 'package:vnshop_mobile/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_state.dart';

class MockCheckoutRepository extends Mock implements CheckoutRepository {}

void main() {
  late MockCheckoutRepository repository;

  const firstAddress = VietnamAddress(
    id: 'address-1',
    recipientName: 'First Buyer',
    phoneNumber: '0900000001',
    streetAddress: '1 First Street',
    ward: 'Ward 1',
    district: 'District 1',
    city: 'Ho Chi Minh City',
  );
  const secondAddress = VietnamAddress(
    id: 'address-2',
    recipientName: 'Second Buyer',
    phoneNumber: '0900000002',
    streetAddress: '2 Second Street',
    ward: 'Ward 2',
    district: 'District 2',
    city: 'Ho Chi Minh City',
  );
  const firstQuote = ShippingQuote(
    id: 'first-quote',
    name: 'Old route',
    description: 'Old address quote',
    price: 20000,
    estimatedDays: 1,
    provider: ShippingProvider.giaoHangNhanh,
  );
  const secondQuote = ShippingQuote(
    id: 'second-quote',
    name: 'New route',
    description: 'New address quote',
    price: 30000,
    estimatedDays: 2,
    provider: ShippingProvider.giaoHangNhanh,
  );

  setUp(() {
    repository = MockCheckoutRepository();
  });

  blocTest<CheckoutBloc, CheckoutState>(
    'clears an old shipping quote as soon as the address changes',
    build: () {
      when(
        () => repository.getShippingQuotes(secondAddress),
      ).thenAnswer((_) async => const [secondQuote]);
      return CheckoutBloc(repository: repository);
    },
    seed: () => const CheckoutState(
      status: CheckoutStatus.ready,
      addresses: [firstAddress, secondAddress],
      selectedAddress: firstAddress,
      shippingQuotes: [firstQuote],
      selectedShipping: firstQuote,
    ),
    act: (bloc) => bloc.add(const CheckoutAddressSelected(secondAddress)),
    expect: () => [
      isA<CheckoutState>()
          .having(
            (state) => state.selectedAddress,
            'selectedAddress',
            secondAddress,
          )
          .having((state) => state.selectedShipping, 'selectedShipping', isNull)
          .having((state) => state.shippingQuotes, 'shippingQuotes', isEmpty),
      isA<CheckoutState>()
          .having(
            (state) => state.isLoadingShipping,
            'isLoadingShipping',
            isTrue,
          )
          .having(
            (state) => state.selectedShipping,
            'selectedShipping',
            isNull,
          ),
      isA<CheckoutState>()
          .having(
            (state) => state.isLoadingShipping,
            'isLoadingShipping',
            isFalse,
          )
          .having(
            (state) => state.selectedShipping,
            'selectedShipping',
            secondQuote,
          ),
    ],
  );
}
