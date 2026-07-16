import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_state.dart';

void main() {
  test('a handled cart failure can be cleared explicitly', () {
    const failed = CartState(failure: CartFailure.removeItem);

    final cleared = failed.copyWith(clearFailure: true);

    expect(cleared.failure, isNull);
  });
}
