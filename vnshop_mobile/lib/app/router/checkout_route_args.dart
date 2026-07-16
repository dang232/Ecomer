import 'package:equatable/equatable.dart';

class CheckoutRouteArgs extends Equatable {
  const CheckoutRouteArgs(this.selectedCartItemIds);

  factory CheckoutRouteArgs.fromIds(Iterable<String> cartItemIds) {
    return CheckoutRouteArgs(Set.unmodifiable(cartItemIds));
  }

  final Set<String> selectedCartItemIds;

  @override
  List<Object?> get props => [selectedCartItemIds];
}
