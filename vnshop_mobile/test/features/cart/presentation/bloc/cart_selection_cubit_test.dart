import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/cart/presentation/bloc/cart_selection_cubit.dart';

void main() {
  test('selects every item on first hydration', () {
    final cubit = CartSelectionCubit();
    addTearDown(cubit.close);

    cubit.reconcile(const ['item-1', 'item-2']);

    expect(cubit.state.selectedItemIds, {'item-1', 'item-2'});
    expect(cubit.state.isAllSelected(const ['item-1', 'item-2']), isTrue);
  });

  test('preserves intent while dropping items no longer in the cart', () {
    final cubit = CartSelectionCubit();
    addTearDown(cubit.close);
    cubit.reconcile(const ['item-1', 'item-2', 'item-3']);
    cubit.toggle('item-2');

    cubit.reconcile(const ['item-2', 'item-3', 'item-4']);

    expect(cubit.state.selectedItemIds, {'item-3'});
    expect(cubit.state.isSelected('item-2'), isFalse);
  });

  test('toggle all selects or clears the current cart only', () {
    final cubit = CartSelectionCubit();
    addTearDown(cubit.close);
    cubit.reconcile(const ['item-1', 'item-2']);

    cubit.toggleAll(const ['item-1', 'item-2']);
    expect(cubit.state.selectedItemIds, isEmpty);

    cubit.toggleAll(const ['item-2', 'item-3']);
    expect(cubit.state.selectedItemIds, {'item-2', 'item-3'});
  });
}
