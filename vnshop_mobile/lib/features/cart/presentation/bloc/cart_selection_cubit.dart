import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class CartSelectionState extends Equatable {
  CartSelectionState({
    Set<String> selectedItemIds = const {},
    this.isInitialized = false,
  }) : selectedItemIds = Set.unmodifiable(selectedItemIds);

  final Set<String> selectedItemIds;
  final bool isInitialized;

  bool isSelected(String cartItemId) => selectedItemIds.contains(cartItemId);

  bool isAllSelected(Iterable<String> cartItemIds) {
    final ids = cartItemIds.toSet();
    return ids.isNotEmpty &&
        ids.length == selectedItemIds.length &&
        ids.every(selectedItemIds.contains);
  }

  @override
  List<Object?> get props => [selectedItemIds, isInitialized];
}

class CartSelectionCubit extends Cubit<CartSelectionState> {
  CartSelectionCubit() : super(CartSelectionState());

  void reconcile(Iterable<String> cartItemIds) {
    final availableIds = cartItemIds.toSet();
    final selectedIds = state.isInitialized
        ? state.selectedItemIds.intersection(availableIds)
        : availableIds;
    emit(CartSelectionState(selectedItemIds: selectedIds, isInitialized: true));
  }

  void toggle(String cartItemId) {
    final selectedIds = state.selectedItemIds.toSet();
    if (!selectedIds.remove(cartItemId)) {
      selectedIds.add(cartItemId);
    }
    emit(CartSelectionState(selectedItemIds: selectedIds, isInitialized: true));
  }

  void toggleAll(Iterable<String> cartItemIds) {
    final availableIds = cartItemIds.toSet();
    emit(
      CartSelectionState(
        selectedItemIds: state.isAllSelected(availableIds)
            ? const {}
            : availableIds,
        isInitialized: true,
      ),
    );
  }

  void clear() {
    emit(CartSelectionState(isInitialized: true));
  }
}
