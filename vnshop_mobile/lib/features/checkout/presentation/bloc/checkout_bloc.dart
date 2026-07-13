import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

import '../../data/models/checkout_session.dart';
import '../../data/models/payment_transaction.dart';
import '../../domain/repositories/checkout_repository.dart';
import 'checkout_event.dart';
import 'checkout_state.dart' show CheckoutState, CheckoutStatus;

class CheckoutBloc extends Bloc<CheckoutEvent, CheckoutState> {
  final CheckoutRepository _repository;
  final Uuid _uuid;

  static const String _guestUserId = 'guest';

  CheckoutBloc({
    required CheckoutRepository repository,
    Uuid? uuid,
  })  : _repository = repository,
        _uuid = uuid ?? const Uuid(),
        super(const CheckoutState()) {
    on<CheckoutStarted>(_onCheckoutStarted);
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
    on<CheckoutReset>(_onReset);
  }

  Future<void> _onCheckoutStarted(
    CheckoutStarted event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(status: CheckoutStatus.loading));

    try {
      final lineItems = event.lineItems.map((item) => LineItem(
            productId: item.productId,
            variantSku: item.variantSku,
            quantity: item.quantity,
          )).toList();
      final session = await _repository.createSession(
        userId: _guestUserId,
        lineItems: lineItems,
        subtotal: event.subtotal,
        discountAmount: event.discountAmount,
        couponCode: event.couponCode,
      );

      emit(state.copyWith(
        status: CheckoutStatus.addressesLoaded,
        session: session,
      ));

      // Auto-load addresses
      add(const CheckoutAddressesLoaded());
    } catch (e) {
      emit(state.copyWith(
        status: CheckoutStatus.error,
        errorMessage: 'Không thể khởi tạo thanh toán: ${e.toString()}',
      ));
    }
  }

  Future<void> _onAddressesLoaded(
    CheckoutAddressesLoaded event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true));

    try {
      final addresses = await _repository.getAddresses();
      final defaultAddress = addresses.isNotEmpty
          ? addresses.firstWhere(
              (a) => a.isDefault,
              orElse: () => addresses.first,
            )
          : null;

      emit(state.copyWith(
        status: CheckoutStatus.addressesLoaded,
        addresses: addresses,
        selectedAddress: state.selectedAddress ?? defaultAddress,
        isLoadingAddresses: false,
      ));

      // Auto-load shipping quotes if address is selected
      if (defaultAddress != null) {
        add(CheckoutShippingQuotesRequested(defaultAddress));
      }
    } catch (e) {
      emit(state.copyWith(
        isLoadingAddresses: false,
        errorMessage: 'Không thể tải danh sách địa chỉ: ${e.toString()}',
      ));
    }
  }

  Future<void> _onAddressSelected(
    CheckoutAddressSelected event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(selectedAddress: event.address));

    // Load shipping quotes for new address
    add(CheckoutShippingQuotesRequested(event.address));
  }

  Future<void> _onAddressAdded(
    CheckoutAddressAdded event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true));

    try {
      final savedAddress = await _repository.addAddress(event.address);
      final updatedAddresses = [...state.addresses, savedAddress];

      emit(state.copyWith(
        addresses: updatedAddresses,
        selectedAddress: savedAddress,
        isLoadingAddresses: false,
      ));

      // Load shipping quotes for new address
      add(CheckoutShippingQuotesRequested(savedAddress));
    } catch (e) {
      emit(state.copyWith(
        isLoadingAddresses: false,
        errorMessage: 'Không thể thêm địa chỉ: ${e.toString()}',
      ));
    }
  }

  Future<void> _onAddressUpdated(
    CheckoutAddressUpdated event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true));

    try {
      final updatedAddress = await _repository.updateAddress(event.address);
      final addresses = state.addresses
          .map((address) => address.id == updatedAddress.id ? updatedAddress : address)
          .toList();
      emit(state.copyWith(
        status: CheckoutStatus.addressesLoaded,
        addresses: addresses,
        selectedAddress: state.selectedAddress?.id == updatedAddress.id
            ? updatedAddress
            : state.selectedAddress,
        isLoadingAddresses: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoadingAddresses: false,
        errorMessage: 'KhÃ´ng thá»ƒ cáº­p nháº­t Ä‘á»‹a chá»‰: ${e.toString()}',
      ));
    }
  }

  Future<void> _onAddressDeleted(
    CheckoutAddressDeleted event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingAddresses: true));

    try {
      await _repository.deleteAddress(event.addressId);
      final addresses = state.addresses
          .where((address) => address.id != event.addressId)
          .toList();
      final deletedSelected = state.selectedAddress?.id == event.addressId;
      emit(state.copyWith(
        status: CheckoutStatus.addressesLoaded,
        addresses: addresses,
        selectedAddress: deletedSelected && addresses.isNotEmpty ? addresses.first : null,
        clearSelectedAddress: deletedSelected && addresses.isEmpty,
        isLoadingAddresses: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoadingAddresses: false,
        errorMessage: 'KhÃ´ng thá»ƒ xÃ³a Ä‘á»‹a chá»‰: ${e.toString()}',
      ));
    }
  }

  Future<void> _onShippingQuotesRequested(
    CheckoutShippingQuotesRequested event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isLoadingShipping: true));

    try {
      final quotes = await _repository.getShippingQuotes(event.address);

      // Update session with shipping address
      if (state.session != null) {
        final updatedSession = state.session!.copyWith(
          selectedAddress: event.address,
        );
        await _repository.updateSession(updatedSession);
        emit(state.copyWith(session: updatedSession));
      }

      emit(state.copyWith(
        status: CheckoutStatus.shippingQuotesLoaded,
        shippingQuotes: quotes,
        selectedShipping: quotes.isNotEmpty ? quotes.first : null,
        isLoadingShipping: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        isLoadingShipping: false,
        errorMessage: 'Không thể lấy phí vận chuyển: ${e.toString()}',
      ));
    }
  }

  Future<void> _onShippingSelected(
    CheckoutShippingSelected event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(selectedShipping: event.shipping));

    // Update session
    if (state.session != null) {
      final updatedSession = state.session!.copyWith(
        selectedShipping: event.shipping,
        shippingFee: event.shipping.price,
        totalAmount: state.subtotal + event.shipping.price - state.discountAmount,
      );
      await _repository.updateSession(updatedSession);
      emit(state.copyWith(
        session: updatedSession,
        status: CheckoutStatus.ready,
      ));
    }
  }

  Future<void> _onPaymentMethodSelected(
    CheckoutPaymentMethodSelected event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(selectedPaymentMethod: event.method));

    // Update session
    if (state.session != null) {
      final updatedSession = state.session!.copyWith(
        selectedPaymentMethod: event.method.name,
      );
      await _repository.updateSession(updatedSession);
      emit(state.copyWith(
        session: updatedSession,
        status: CheckoutStatus.ready,
      ));
    }
  }

  Future<void> _onPaymentInitiated(
    CheckoutPaymentInitiated event,
    Emitter<CheckoutState> emit,
  ) async {
    if (!state.canPlaceOrder) {
      emit(state.copyWith(
        status: CheckoutStatus.error,
        errorMessage: 'Vui lòng chọn đầy đủ thông tin thanh toán',
      ));
      return;
    }

    emit(state.copyWith(
      status: CheckoutStatus.processingPayment,
      isProcessingPayment: true,
    ));

    try {
      final idempotencyKey = state.currentTransaction != null
          ? state.session?.idempotencyKey ?? _uuid.v4()
          : _uuid.v4();

      // P0: Create the order FIRST so the payment gateway can attach to a real
      // orderId. Previously we called initiatePayment with the cart sessionId,
      // which leaked orphaned payment transactions when the user never finished.
      final orderId = await _repository.createOrder(
        session: state.session!,
        transaction: _placeholderTransaction(state, idempotencyKey),
        idempotencyKey: idempotencyKey,
      );
      final orderSession = state.session!.copyWith(sessionId: orderId);

      PaymentTransaction? transaction;
      if (state.selectedPaymentMethod != PaymentMethod.cod) {
        transaction = await _repository.initiatePayment(
          session: orderSession,
          method: state.selectedPaymentMethod!,
          idempotencyKey: idempotencyKey,
        );
      }

      emit(state.copyWith(
        session: orderSession,
        orderId: orderId,
        currentTransaction: transaction,
        isProcessingPayment: false,
      ));

      // For COD, the order is already created; just mark placed.
      if (state.selectedPaymentMethod == PaymentMethod.cod) {
        emit(state.copyWith(
          status: CheckoutStatus.orderPlaced,
          orderId: orderId,
        ));
      }
    } catch (e) {
      emit(state.copyWith(
        status: CheckoutStatus.paymentFailed,
        isProcessingPayment: false,
        errorMessage: 'Không thể khởi tạo thanh toán: ${e.toString()}',
      ));
    }
  }

  /// Placeholder transaction used to satisfy createOrder's contract before
  /// the payment gateway has returned a real transaction. The order endpoint
  /// accepts the payment method string, not the transaction id.
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
      final transaction = await _repository.getPaymentStatus(event.transactionId);
      emit(state.copyWith(currentTransaction: transaction));

      if (transaction.status == PaymentStatus.completed) {
        add(const CheckoutOrderPlaced());
      } else if (transaction.status == PaymentStatus.failed) {
        emit(state.copyWith(
          status: CheckoutStatus.paymentFailed,
          errorMessage: transaction.errorMessage,
        ));
      }
    } catch (e) {
      // Silently handle status check errors
    }
  }

  // Kept as a terminal UI state for older callers; no retry endpoint exists.
  // ignore: unused_element
  Future<void> _onPaymentRetried(
    Object event,
    Emitter<CheckoutState> emit,
  ) async {
    emit(state.copyWith(isProcessingPayment: true));

    try {
      emit(state.copyWith(
        status: CheckoutStatus.paymentFailed,
        isProcessingPayment: false,
        errorMessage: 'Thanh toan lai khong duoc ho tro',
      ));
    } catch (e) {
      emit(state.copyWith(
        status: CheckoutStatus.paymentFailed,
        isProcessingPayment: false,
        errorMessage: 'Không thể thử lại thanh toán: ${e.toString()}',
      ));
    }
  }

  Future<void> _onOrderPlaced(
    CheckoutOrderPlaced event,
    Emitter<CheckoutState> emit,
  ) async {
    if (state.orderId != null) {
      emit(state.copyWith(status: CheckoutStatus.orderPlaced));
      return;
    }

    if (state.currentTransaction == null) {
      emit(state.copyWith(
        status: CheckoutStatus.error,
        errorMessage: 'Không tìm thấy giao dịch thanh toán',
      ));
      return;
    }

    try {
      final orderId = await _repository.createOrder(
        session: state.session!,
        transaction: state.currentTransaction!,
        idempotencyKey: state.session!.idempotencyKey,
      );

      emit(state.copyWith(
        status: CheckoutStatus.orderPlaced,
        orderId: orderId,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: CheckoutStatus.error,
        errorMessage: 'Không thể tạo đơn hàng: ${e.toString()}',
      ));
    }
  }

  Future<void> _onOrderCancelled(
    CheckoutOrderCancelled event,
    Emitter<CheckoutState> emit,
  ) async {
    try {
      await _repository.cancelOrder(event.orderId);
      emit(state.copyWith(status: CheckoutStatus.initial));
    } catch (e) {
      emit(state.copyWith(
        errorMessage: 'Không thể hủy đơn hàng: ${e.toString()}',
      ));
    }
  }

  void _onReset(
    CheckoutReset event,
    Emitter<CheckoutState> emit,
  ) {
    emit(const CheckoutState());
  }
}
