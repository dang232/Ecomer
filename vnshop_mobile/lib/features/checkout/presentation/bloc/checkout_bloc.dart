import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

import '../../data/models/address_model.dart';
import '../../data/models/checkout_session.dart';
import '../../data/models/payment_transaction.dart';
import '../../domain/repositories/checkout_repository.dart';
import 'checkout_event.dart';
import 'checkout_state.dart';

class CheckoutBloc extends Bloc<CheckoutEvent, CheckoutState> {
  CheckoutBloc({required this._repository, this.userId, Uuid? uuid})
    : _uuid = uuid ?? const Uuid(),
      super(const CheckoutState()) {
    on<CheckoutStarted>(_onCheckoutStarted);
    on<CheckoutPaymentMethodsRequested>(_onPaymentMethodsRequested);
    on<CheckoutAddressesLoaded>(_onAddressesLoaded);
    on<CheckoutAddressSelected>(_onAddressSelected);
    on<CheckoutAddressAdded>(_onAddressAdded);
    on<CheckoutAddressUpdated>(_onAddressUpdated);
    on<CheckoutAddressDeleted>(_onAddressDeleted);
    on<CheckoutShippingQuotesRequested>(_onShippingQuotesRequested);
    on<CheckoutShippingSelected>(_onShippingSelected);
    on<CheckoutPaymentMethodSelected>(_onPaymentMethodSelected);
    on<CheckoutPaymentInitiated>(_onPaymentInitiated);
    on<CheckoutPaymentStatusChecked>(_onPaymentStatusChecked);
    on<CheckoutOrderPlaced>(_onOrderPlaced);
    on<CheckoutOrderCancelled>(_onOrderCancelled);
    on<CheckoutFailureDismissed>(_onFailureDismissed);
    on<CheckoutReset>(_onReset);
  }

  final CheckoutRepository _repository;
  final String? userId;
  final Uuid _uuid;

  Future<void> _onCheckoutStarted(
    CheckoutStarted event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(status: CheckoutStatus.loading, clearFailure: true));

    final authenticatedUserId = userId;
    if (authenticatedUserId == null || authenticatedUserId.isEmpty) {
      emit(state.copyWith(status: CheckoutStatus.error, failure: CheckoutFailure.initialize));
      return;
    }

    try {
      final lineItems = event.lineItems
          .map(
            (item) => LineItem(
              productId: item.productId,
              variantSku: item.variantSku,
              quantity: item.quantity,
            ),
          )
          .toList(growable: false);
      final session = await _repository.createSession(
        userId: authenticatedUserId,
        lineItems: lineItems,
        subtotal: event.subtotal,
        discountAmount: event.discountAmount,
        couponCode: event.couponCode,
      );

      emit(
        state.copyWith(
          status: CheckoutStatus.addressesLoaded,
          session: session,
          clearFailure: true,
        ),
      );
      add(const CheckoutAddressesLoaded());
      add(const CheckoutPaymentMethodsRequested());
    } catch (_) {
      emit(
        state.copyWith(
          status: CheckoutStatus.error,
          failure: CheckoutFailure.initialize,
        ),
      );
    }
  }

  Future<void> _onAddressesLoaded(
    CheckoutAddressesLoaded event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true, clearFailure: true));

    try {
      final addresses = await _repository.getAddresses();
      final selectedAddress = _selectedAddressFor(addresses);
      emit(
        state.copyWith(
          status: CheckoutStatus.addressesLoaded,
          addresses: addresses,
          selectedAddress: selectedAddress,
          clearSelectedAddress: selectedAddress == null,
          clearSelectedShipping: selectedAddress == null,
          shippingQuotes: selectedAddress == null ? const [] : null,
          isLoadingAddresses: false,
          clearFailure: true,
        ),
      );

      if (selectedAddress != null) {
        add(CheckoutShippingQuotesRequested(selectedAddress));
      }
    } catch (_) {
      emit(
        state.copyWith(
          isLoadingAddresses: false,
          failure: CheckoutFailure.loadAddresses,
        ),
      );
    }
  }

  VietnamAddress? _selectedAddressFor(List<VietnamAddress> addresses) {
    if (addresses.isEmpty) return null;
    final currentId = state.selectedAddress?.id;
    if (currentId != null) {
      for (final address in addresses) {
        if (address.id == currentId) return address;
      }
    }
    return addresses.firstWhere(
      (address) => address.isDefault,
      orElse: () => addresses.first,
    );
  }

  void _onAddressSelected(
    CheckoutAddressSelected event,
    Emitter<CheckoutState> emit,
  ) {
    emit(
      state.copyWith(
        selectedAddress: event.address,
        shippingQuotes: const [],
        clearSelectedShipping: true,
        clearFailure: true,
      ),
    );
    add(CheckoutShippingQuotesRequested(event.address));
  }

  Future<void> _onAddressAdded(
    CheckoutAddressAdded event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true, clearFailure: true));
    try {
      final savedAddress = await _repository.addAddress(event.address);
      emit(
        state.copyWith(
          addresses: [...state.addresses, savedAddress],
          selectedAddress: savedAddress,
          shippingQuotes: const [],
          clearSelectedShipping: true,
          isLoadingAddresses: false,
          clearFailure: true,
        ),
      );
      add(CheckoutShippingQuotesRequested(savedAddress));
    } catch (_) {
      emit(
        state.copyWith(
          isLoadingAddresses: false,
          failure: CheckoutFailure.addAddress,
        ),
      );
    }
  }

  Future<void> _onAddressUpdated(
    CheckoutAddressUpdated event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true, clearFailure: true));
    try {
      final updated = await _repository.updateAddress(event.address);
      final addresses = state.addresses
          .map((address) => address.id == updated.id ? updated : address)
          .toList(growable: false);
      final wasSelected = state.selectedAddress?.id == updated.id;
      emit(
        state.copyWith(
          status: CheckoutStatus.addressesLoaded,
          addresses: addresses,
          selectedAddress: wasSelected ? updated : state.selectedAddress,
          shippingQuotes: wasSelected ? const [] : null,
          clearSelectedShipping: wasSelected,
          isLoadingAddresses: false,
          clearFailure: true,
        ),
      );
      if (wasSelected) {
        add(CheckoutShippingQuotesRequested(updated));
      }
    } catch (_) {
      emit(
        state.copyWith(
          isLoadingAddresses: false,
          failure: CheckoutFailure.updateAddress,
        ),
      );
    }
  }

  Future<void> _onAddressDeleted(
    CheckoutAddressDeleted event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true, clearFailure: true));
    try {
      await _repository.deleteAddress(event.addressId);
      final addresses = state.addresses
          .where((address) => address.id != event.addressId)
          .toList(growable: false);
      final deletedSelected = state.selectedAddress?.id == event.addressId;
      final replacement = deletedSelected && addresses.isNotEmpty
          ? addresses.first
          : state.selectedAddress;
      emit(
        state.copyWith(
          status: CheckoutStatus.addressesLoaded,
          addresses: addresses,
          selectedAddress: replacement,
          clearSelectedAddress: deletedSelected && replacement == null,
          shippingQuotes: deletedSelected ? const [] : null,
          clearSelectedShipping: deletedSelected,
          isLoadingAddresses: false,
          clearFailure: true,
        ),
      );
      if (deletedSelected && replacement != null) {
        add(CheckoutShippingQuotesRequested(replacement));
      }
    } catch (_) {
      emit(
        state.copyWith(
          isLoadingAddresses: false,
          failure: CheckoutFailure.deleteAddress,
        ),
      );
    }
  }

  Future<void> _onPaymentMethodsRequested(
    CheckoutPaymentMethodsRequested event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingPaymentMethods: true, clearFailure: true));
    try {
      final methods = await _repository.getAvailablePaymentMethods();
      final selectedMethod = state.selectedPaymentMethod;
      emit(
        state.copyWith(
          availablePaymentMethods: methods,
          isLoadingPaymentMethods: false,
          clearSelectedPaymentMethod:
              selectedMethod != null && !methods.contains(selectedMethod),
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(
          isLoadingPaymentMethods: false,
          failure: CheckoutFailure.loadPaymentMethods,
        ),
      );
    }
  }

  Future<void> _onShippingQuotesRequested(
    CheckoutShippingQuotesRequested event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(
      state.copyWith(
        isLoadingShipping: true,
        shippingQuotes: const [],
        clearSelectedShipping: true,
        clearFailure: true,
      ),
    );
    try {
      final quotes = await _repository.getShippingQuotes(event.address);
      final selectedShipping = quotes.isEmpty ? null : quotes.first;
      var session = state.session;
      if (session != null) {
        final pendingSession = session.copyWith(
          selectedAddress: event.address,
          selectedShipping: selectedShipping,
          shippingFee: selectedShipping?.price ?? 0,
          totalAmount:
              state.subtotal +
              (selectedShipping?.price ?? 0) -
              state.discountAmount,
        );
        session = await _repository.updateSession(pendingSession);
      }
      emit(
        state.copyWith(
          status: CheckoutStatus.shippingQuotesLoaded,
          session: session,
          shippingQuotes: quotes,
          selectedShipping: selectedShipping,
          clearSelectedShipping: selectedShipping == null,
          isLoadingShipping: false,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(
          isLoadingShipping: false,
          failure: CheckoutFailure.loadShipping,
        ),
      );
    }
  }

  Future<void> _onShippingSelected(
    CheckoutShippingSelected event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(selectedShipping: event.shipping, clearFailure: true));
    final session = state.session;
    if (session == null) return;

    try {
      final updatedSession = await _repository.updateSession(
        session.copyWith(
          selectedShipping: event.shipping,
          shippingFee: event.shipping.price,
          totalAmount:
              state.subtotal + event.shipping.price - state.discountAmount,
        ),
      );
      emit(
        state.copyWith(
          session: updatedSession,
          status: CheckoutStatus.ready,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(state.copyWith(failure: CheckoutFailure.updateSession));
    }
  }

  Future<void> _onPaymentMethodSelected(
    CheckoutPaymentMethodSelected event,
    Emitter<CheckoutState> emit,
  ) async {
    if (!state.availablePaymentMethods.contains(event.method)) {
      emit(state.copyWith(failure: CheckoutFailure.paymentMethodUnavailable));
      return;
    }

    emit(
      state.copyWith(selectedPaymentMethod: event.method, clearFailure: true),
    );
    final session = state.session;
    if (session == null) return;

    try {
      final updatedSession = await _repository.updateSession(
        session.copyWith(selectedPaymentMethod: event.method.name),
      );
      emit(
        state.copyWith(
          session: updatedSession,
          status: CheckoutStatus.ready,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(state.copyWith(failure: CheckoutFailure.updateSession));
    }
  }

  Future<void> _onPaymentInitiated(
    CheckoutPaymentInitiated event,
    Emitter<CheckoutState> emit,
  ) async {
    if (!state.canPlaceOrder || state.session == null) {
      emit(state.copyWith(failure: CheckoutFailure.incomplete));
      return;
    }

    emit(
      state.copyWith(
        status: CheckoutStatus.processingPayment,
        isProcessingPayment: true,
        clearFailure: true,
      ),
    );
    try {
      final existingOrderId = state.orderId;
      final idempotencyKey = existingOrderId == null
          ? _uuid.v4()
          : state.session!.idempotencyKey;
      late final String orderId;
      late final CheckoutSession orderSession;

      if (existingOrderId == null) {
        orderId = await _repository.createOrder(
          session: state.session!,
          transaction: _placeholderTransaction(state, idempotencyKey),
          idempotencyKey: idempotencyKey,
        );
        orderSession = state.session!.copyWith(
          sessionId: orderId,
          idempotencyKey: idempotencyKey,
        );

        // Persist the created order before contacting an external provider so
        // a provider retry cannot create another order.
        emit(
          state.copyWith(
            session: orderSession,
            orderId: orderId,
            status: CheckoutStatus.processingPayment,
            isProcessingPayment: true,
            clearFailure: true,
          ),
        );
      } else {
        orderId = existingOrderId;
        orderSession = state.session!.copyWith(sessionId: orderId);
      }

      if (state.selectedPaymentMethod == PaymentMethod.cod) {
        emit(
          state.copyWith(
            status: CheckoutStatus.orderPlaced,
            session: orderSession,
            orderId: orderId,
            isProcessingPayment: false,
            clearFailure: true,
          ),
        );
        return;
      }

      final transaction = await _repository.initiatePayment(
        session: orderSession,
        method: state.selectedPaymentMethod!,
        idempotencyKey: idempotencyKey,
      );
      emit(
        state.copyWith(
          status: CheckoutStatus.awaitingPayment,
          session: orderSession,
          orderId: orderId,
          currentTransaction: transaction,
          isProcessingPayment: false,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(
          status: CheckoutStatus.paymentFailed,
          isProcessingPayment: false,
          failure: CheckoutFailure.initiatePayment,
        ),
      );
    }
  }

  PaymentTransaction _placeholderTransaction(
    CheckoutState state,
    String idempotencyKey,
  ) {
    return PaymentTransaction(
      id: '',
      orderId: '',
      idempotencyKey: idempotencyKey,
      method: state.selectedPaymentMethod!,
      status: PaymentStatus.pending,
      amount: state.session!.totalAmount,
      createdAt: DateTime.now(),
    );
  }

  Future<void> _onPaymentStatusChecked(
    CheckoutPaymentStatusChecked event,
    Emitter<CheckoutState> emit,
  ) async {
    try {
      final transaction = await _repository.getPaymentStatus(
        event.transactionId,
      );
      emit(state.copyWith(currentTransaction: transaction, clearFailure: true));
      if (transaction.status == PaymentStatus.completed) {
        add(const CheckoutOrderPlaced());
      } else if (transaction.status == PaymentStatus.failed) {
        emit(
          state.copyWith(
            status: CheckoutStatus.paymentFailed,
            failure: CheckoutFailure.paymentFailed,
          ),
        );
      }
    } catch (_) {
      emit(state.copyWith(failure: CheckoutFailure.paymentStatus));
    }
  }

  Future<void> _onOrderPlaced(
    CheckoutOrderPlaced event,
    Emitter<CheckoutState> emit,
  ) async {
    if (state.orderId != null) {
      emit(
        state.copyWith(status: CheckoutStatus.orderPlaced, clearFailure: true),
      );
      return;
    }
    if (state.currentTransaction == null || state.session == null) {
      emit(
        state.copyWith(
          status: CheckoutStatus.error,
          failure: CheckoutFailure.transactionMissing,
        ),
      );
      return;
    }
    try {
      final orderId = await _repository.createOrder(
        session: state.session!,
        transaction: state.currentTransaction!,
        idempotencyKey: state.session!.idempotencyKey,
      );
      emit(
        state.copyWith(
          status: CheckoutStatus.orderPlaced,
          orderId: orderId,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(
          status: CheckoutStatus.error,
          failure: CheckoutFailure.createOrder,
        ),
      );
    }
  }

  Future<void> _onOrderCancelled(
    CheckoutOrderCancelled event,
    Emitter<CheckoutState> emit,
  ) async {
    try {
      await _repository.cancelOrder(event.orderId);
      emit(const CheckoutState());
    } catch (_) {
      emit(state.copyWith(failure: CheckoutFailure.cancelOrder));
    }
  }

  void _onFailureDismissed(
    CheckoutFailureDismissed event,
    Emitter<CheckoutState> emit,
  ) {
    emit(state.copyWith(clearFailure: true));
  }

  void _onReset(CheckoutReset event, Emitter<CheckoutState> emit) {
    emit(const CheckoutState());
  }
}
