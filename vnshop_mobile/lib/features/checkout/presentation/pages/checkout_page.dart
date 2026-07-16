import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../app/router/checkout_route_args.dart';
import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../cart/presentation/bloc/cart_bloc.dart';
import '../../../cart/presentation/bloc/cart_event.dart';
import '../../data/models/address_model.dart';
import '../../data/models/payment_transaction.dart';
import '../../data/models/shipping_quote.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import '../mappers/checkout_presentation_mapper.dart';
import '../models/checkout_cart_input.dart';
import '../widgets/address_card.dart';
import '../widgets/checkout_bottom_bar.dart';
import '../widgets/order_summary_sheet.dart';
import '../widgets/payment_method_card.dart';
import '../widgets/payment_method_selector.dart';
import '../widgets/shipping_method_card.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key, this.routeArgs});

  final CheckoutRouteArgs? routeArgs;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  late final CheckoutCartInput _cartInput;
  bool _didCleanPurchasedItems = false;
  String? _presentedOrderId;

  @override
  void initState() {
    super.initState();
    final cartState = context.read<CartBloc>().state;
    _cartInput = CheckoutCartInput.fromCart(
      cartState.cart,
      args: widget.routeArgs,
    );
    _startCheckout();
  }

  void _startCheckout() {
    if (_cartInput.isEmpty) return;
    context.read<CheckoutBloc>().add(
      CheckoutStarted(
        lineItems: _cartInput.items
            .map(
              (item) => LineItemData(
                productId: item.productId,
                variantSku: item.sku,
                quantity: item.quantity,
              ),
            )
            .toList(growable: false),
        subtotal: _cartInput.subtotal,
        discountAmount: _cartInput.discountAmount,
        couponCode: _cartInput.couponCode,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.checkout),
        centerTitle: false,
        leading: IconButton(
          tooltip: MaterialLocalizations.of(context).backButtonTooltip,
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back),
        ),
      ),
      body: _cartInput.isEmpty
          ? const _EmptyCheckoutState()
          : BlocConsumer<CheckoutBloc, CheckoutState>(
              listenWhen: (previous, current) =>
                  previous.status != current.status ||
                  previous.failure != current.failure ||
                  previous.orderId != current.orderId,
              listener: _handleStateChange,
              builder: (context, state) {
                if (state.status == CheckoutStatus.loading &&
                    state.session == null) {
                  return const _CheckoutLoadingView();
                }

                if (state.failure == CheckoutFailure.initialize &&
                    state.session == null) {
                  return _BlockingCheckoutError(onRetry: _startCheckout);
                }

                return _CheckoutContent(
                  state: state,
                  cartInput: _cartInput,
                  onAddAddress: () =>
                      context.push(AppRoutes.checkoutAddressNew),
                  onEditAddress: (address) =>
                      context.push(AppRoutes.checkoutAddress(address.id)),
                  onDeleteAddress: _confirmDeleteAddress,
                  onRetryAddresses: () => context.read<CheckoutBloc>().add(
                    const CheckoutAddressesLoaded(),
                  ),
                  onRetryShipping: (address) => context
                      .read<CheckoutBloc>()
                      .add(CheckoutShippingQuotesRequested(address)),
                  onRetryPaymentMethods: () => context.read<CheckoutBloc>().add(
                    const CheckoutPaymentMethodsRequested(),
                  ),
                  onAddressSelected: (address) => context
                      .read<CheckoutBloc>()
                      .add(CheckoutAddressSelected(address)),
                  onShippingSelected: (shipping) => context
                      .read<CheckoutBloc>()
                      .add(CheckoutShippingSelected(shipping)),
                  onPaymentSelected: (method) => context
                      .read<CheckoutBloc>()
                      .add(CheckoutPaymentMethodSelected(method)),
                  onRetryPayment: () => context.read<CheckoutBloc>().add(
                    const CheckoutPaymentInitiated(),
                  ),
                  onOpenPaymentUrl: _openPaymentUrl,
                  onCheckPayment: (transactionId) => context
                      .read<CheckoutBloc>()
                      .add(CheckoutPaymentStatusChecked(transactionId)),
                );
              },
            ),
      bottomNavigationBar: _cartInput.isEmpty
          ? null
          : BlocBuilder<CheckoutBloc, CheckoutState>(
              buildWhen: (previous, current) =>
                  previous.totalAmount != current.totalAmount ||
                  previous.canPlaceOrder != current.canPlaceOrder ||
                  previous.isProcessingPayment != current.isProcessingPayment ||
                  previous.selectedPaymentMethod !=
                      current.selectedPaymentMethod ||
                  previous.status != current.status,
              builder: (context, state) {
                final hideAction =
                    state.session == null ||
                    state.status == CheckoutStatus.awaitingPayment ||
                    state.status == CheckoutStatus.orderPlaced ||
                    state.status == CheckoutStatus.paymentFailed;
                if (hideAction) return const SizedBox.shrink();

                return CheckoutBottomBar(
                  totalAmount: state.totalAmount,
                  isEnabled: state.canPlaceOrder,
                  isLoading: state.isProcessingPayment,
                  paymentMethod: state.selectedPaymentMethod,
                  onPlaceOrder: () => context.read<CheckoutBloc>().add(
                    const CheckoutPaymentInitiated(),
                  ),
                );
              },
            ),
    );
  }

  void _handleStateChange(BuildContext context, CheckoutState state) {
    final failure = state.failure;
    if (failure != null && !_isInlineFailure(failure)) {
      final localizations = AppLocalizations.of(context);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(failure.localizedMessage(localizations)),
            behavior: SnackBarBehavior.floating,
          ),
        );
      context.read<CheckoutBloc>().add(const CheckoutFailureDismissed());
    }

    if (state.status != CheckoutStatus.orderPlaced) return;
    final presentationId = state.orderId ?? 'placed';
    if (_presentedOrderId == presentationId) return;
    _presentedOrderId = presentationId;

    if (!_didCleanPurchasedItems) {
      _didCleanPurchasedItems = true;
      context.read<CartBloc>().add(
        CartCheckoutCompleted(_cartInput.selectedCartItemIds),
      );
    }
    _showOrderSuccess(state.orderId);
  }

  bool _isInlineFailure(CheckoutFailure failure) {
    return failure == CheckoutFailure.initialize ||
        failure == CheckoutFailure.loadAddresses ||
        failure == CheckoutFailure.loadShipping ||
        failure == CheckoutFailure.loadPaymentMethods;
  }

  Future<void> _confirmDeleteAddress(VietnamAddress address) async {
    final localizations = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(localizations.deleteAddress),
        content: Text(
          localizations.deleteAddressConfirmation(address.recipientName),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(localizations.cancel),
          ),
          FilledButton.tonalIcon(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            icon: const Icon(Icons.delete_outline),
            label: Text(localizations.remove),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      context.read<CheckoutBloc>().add(CheckoutAddressDeleted(address.id));
    }
  }

  Future<void> _openPaymentUrl(String rawUrl) async {
    final uri = Uri.tryParse(rawUrl);
    final isSupported =
        uri != null && (uri.scheme == 'https' || uri.scheme == 'http');
    final launched = isSupported
        ? await launchUrl(uri, mode: LaunchMode.externalApplication)
        : false;
    if (!launched && mounted) {
      final message = AppLocalizations.of(context).checkoutPaymentStartError;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _showOrderSuccess(String? orderId) async {
    if (!mounted) return;
    final localizations = AppLocalizations.of(context);
    await showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      builder: (sheetContext) => PopScope(
        canPop: false,
        child: SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg + MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle_outline,
                  size: 64,
                  color: Theme.of(sheetContext).colorScheme.tertiary,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  localizations.orderPlacedTitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(sheetContext).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  localizations.orderPlacedHelp,
                  textAlign: TextAlign.center,
                  style: Theme.of(sheetContext).textTheme.bodyLarge,
                ),
                if (orderId != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  SelectableText(
                    localizations.orderNumber(orderId),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                VnPrimaryButton(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    context.go(AppRoutes.orders);
                  },
                  label: localizations.viewOrders,
                  icon: const Icon(Icons.receipt_long_outlined),
                ),
                const SizedBox(height: AppSpacing.sm),
                VnSecondaryButton(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    context.go(AppRoutes.home);
                  },
                  label: localizations.continueShopping,
                  icon: const Icon(Icons.storefront_outlined),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CheckoutContent extends StatelessWidget {
  const _CheckoutContent({
    required this.state,
    required this.cartInput,
    required this.onAddAddress,
    required this.onEditAddress,
    required this.onDeleteAddress,
    required this.onRetryAddresses,
    required this.onRetryShipping,
    required this.onRetryPaymentMethods,
    required this.onAddressSelected,
    required this.onShippingSelected,
    required this.onPaymentSelected,
    required this.onRetryPayment,
    required this.onOpenPaymentUrl,
    required this.onCheckPayment,
  });

  final CheckoutState state;
  final CheckoutCartInput cartInput;
  final VoidCallback onAddAddress;
  final ValueChanged<VietnamAddress> onEditAddress;
  final ValueChanged<VietnamAddress> onDeleteAddress;
  final VoidCallback onRetryAddresses;
  final ValueChanged<VietnamAddress> onRetryShipping;
  final VoidCallback onRetryPaymentMethods;
  final ValueChanged<VietnamAddress> onAddressSelected;
  final ValueChanged<ShippingQuote> onShippingSelected;
  final ValueChanged<PaymentMethod> onPaymentSelected;
  final VoidCallback onRetryPayment;
  final ValueChanged<String> onOpenPaymentUrl;
  final ValueChanged<String> onCheckPayment;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.responsiveSpacing(context, mobile: AppSpacing.md),
        AppSpacing.md,
        AppSpacing.responsiveSpacing(context, mobile: AppSpacing.md),
        AppSpacing.xl,
      ),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _CheckoutSection(
                  icon: Icons.location_on_outlined,
                  title: localizations.checkoutDeliveryAddress,
                  action: IconButton(
                    onPressed: onAddAddress,
                    tooltip: localizations.addNewAddress,
                    icon: const Icon(Icons.add),
                  ),
                  child: _AddressSection(
                    state: state,
                    onAddAddress: onAddAddress,
                    onEditAddress: onEditAddress,
                    onDeleteAddress: onDeleteAddress,
                    onRetry: onRetryAddresses,
                    onSelected: onAddressSelected,
                  ),
                ),
                _CheckoutSection(
                  icon: Icons.local_shipping_outlined,
                  title: localizations.checkoutDeliveryMethod,
                  child: _ShippingSection(
                    state: state,
                    onRetry: onRetryShipping,
                    onSelected: onShippingSelected,
                  ),
                ),
                _CheckoutSection(
                  icon: Icons.payment_outlined,
                  title: localizations.checkoutPaymentMethod,
                  child: _PaymentSection(
                    state: state,
                    onRetry: onRetryPaymentMethods,
                    onSelected: onPaymentSelected,
                  ),
                ),
                if (state.status == CheckoutStatus.awaitingPayment &&
                    state.currentTransaction != null)
                  _PendingPaymentPanel(
                    transaction: state.currentTransaction!,
                    onOpenPaymentUrl: onOpenPaymentUrl,
                    onCheckPayment: onCheckPayment,
                  ),
                if (state.status == CheckoutStatus.paymentFailed)
                  _PaymentFailedPanel(onRetry: onRetryPayment),
                _CheckoutSection(
                  icon: Icons.receipt_long_outlined,
                  title: localizations.checkoutReviewOrder,
                  showDivider: false,
                  child: OrderSummarySheet(
                    cartItems: cartInput.items,
                    subtotal: state.session?.subtotal ?? cartInput.subtotal,
                    shippingFee: state.shippingFee,
                    discountAmount:
                        state.session?.discountAmount ??
                        cartInput.discountAmount,
                    couponCode:
                        state.session?.couponCode ?? cartInput.couponCode,
                    isShippingCalculated: state.selectedShipping != null,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CheckoutSection extends StatelessWidget {
  const _CheckoutSection({
    required this.icon,
    required this.title,
    required this.child,
    this.action,
    this.showDivider = true,
  });

  final IconData icon;
  final String title;
  final Widget child;
  final Widget? action;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final heading = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 24, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final stackHeader =
                  action != null &&
                  (constraints.maxWidth < 380 ||
                      MediaQuery.textScalerOf(context).scale(1) > 1.4);
              if (action == null) return heading;
              if (stackHeader) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    heading,
                    const SizedBox(height: AppSpacing.xs),
                    action!,
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(child: heading),
                  const SizedBox(width: AppSpacing.sm),
                  action!,
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
          if (showDivider) ...[
            const SizedBox(height: AppSpacing.lg),
            const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}

class _AddressSection extends StatelessWidget {
  const _AddressSection({
    required this.state,
    required this.onAddAddress,
    required this.onEditAddress,
    required this.onDeleteAddress,
    required this.onRetry,
    required this.onSelected,
  });

  final CheckoutState state;
  final VoidCallback onAddAddress;
  final ValueChanged<VietnamAddress> onEditAddress;
  final ValueChanged<VietnamAddress> onDeleteAddress;
  final VoidCallback onRetry;
  final ValueChanged<VietnamAddress> onSelected;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    if (state.isLoadingAddresses && state.addresses.isEmpty) {
      return const Column(
        children: [AddressCardSkeleton(), AddressCardSkeleton()],
      );
    }
    if (state.failure == CheckoutFailure.loadAddresses &&
        state.addresses.isEmpty) {
      return _InlineState(
        icon: Icons.cloud_off_outlined,
        title: localizations.checkoutAddressesLoadError,
        actionLabel: localizations.retry,
        onAction: onRetry,
      );
    }
    if (state.addresses.isEmpty) {
      return _InlineState(
        icon: Icons.add_location_alt_outlined,
        title: localizations.noAddressTitle,
        message: localizations.noAddressHelp,
        actionLabel: localizations.addNewAddress,
        actionIcon: Icons.add,
        onAction: onAddAddress,
      );
    }

    return Column(
      children: [
        if (state.isLoadingAddresses) const LinearProgressIndicator(),
        if (state.failure == CheckoutFailure.loadAddresses)
          _InlineState(
            icon: Icons.cloud_off_outlined,
            title: localizations.checkoutAddressesLoadError,
            actionLabel: localizations.retry,
            onAction: onRetry,
            compact: true,
          ),
        RadioGroup<VietnamAddress>(
          groupValue: state.selectedAddress,
          onChanged: (address) {
            if (address != null) onSelected(address);
          },
          child: Column(
            children: [
              for (final address in state.addresses)
                AddressCard(
                  address: address,
                  isSelected: address.id == state.selectedAddress?.id,
                  onTap: () => onSelected(address),
                  onEdit: () => onEditAddress(address),
                  onDelete: () => onDeleteAddress(address),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ShippingSection extends StatelessWidget {
  const _ShippingSection({
    required this.state,
    required this.onRetry,
    required this.onSelected,
  });

  final CheckoutState state;
  final ValueChanged<VietnamAddress> onRetry;
  final ValueChanged<ShippingQuote> onSelected;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final selectedAddress = state.selectedAddress;
    if (selectedAddress == null) {
      return _InlineState(
        icon: Icons.location_searching_outlined,
        title: localizations.selectAddressFirst,
      );
    }
    if (state.isLoadingShipping) {
      return const Column(
        children: [ShippingMethodCardSkeleton(), ShippingMethodCardSkeleton()],
      );
    }
    if (state.failure == CheckoutFailure.loadShipping) {
      return _InlineState(
        icon: Icons.local_shipping_outlined,
        title: localizations.shippingMethodsLoadError,
        actionLabel: localizations.retry,
        onAction: () => onRetry(selectedAddress),
      );
    }

    final availableQuotes = state.shippingQuotes
        .where((quote) => quote.isAvailable)
        .toList(growable: false);
    if (availableQuotes.isEmpty) {
      return _InlineState(
        icon: Icons.wrong_location_outlined,
        title: localizations.noShippingMethods,
      );
    }

    return RadioGroup<ShippingQuote>(
      groupValue: state.selectedShipping,
      onChanged: (quote) {
        if (quote != null) onSelected(quote);
      },
      child: Column(
        children: [
          for (final quote in availableQuotes)
            ShippingMethodCard(
              shipping: quote,
              isSelected: quote.id == state.selectedShipping?.id,
              onTap: () => onSelected(quote),
            ),
        ],
      ),
    );
  }
}

class _PaymentSection extends StatelessWidget {
  const _PaymentSection({
    required this.state,
    required this.onRetry,
    required this.onSelected,
  });

  final CheckoutState state;
  final VoidCallback onRetry;
  final ValueChanged<PaymentMethod> onSelected;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    if (state.isLoadingPaymentMethods) {
      return const Column(
        children: [PaymentMethodCardSkeleton(), PaymentMethodCardSkeleton()],
      );
    }
    if (state.failure == CheckoutFailure.loadPaymentMethods) {
      return _InlineState(
        icon: Icons.credit_card_off_outlined,
        title: localizations.paymentMethodsLoadError,
        actionLabel: localizations.retry,
        onAction: onRetry,
      );
    }
    if (state.availablePaymentMethods.isEmpty) {
      return _InlineState(
        icon: Icons.credit_card_off_outlined,
        title: localizations.noPaymentMethods,
      );
    }

    return PaymentMethodSelector(
      methods: state.availablePaymentMethods,
      selectedMethod: state.selectedPaymentMethod,
      onMethodSelected: onSelected,
    );
  }
}

class _PendingPaymentPanel extends StatelessWidget {
  const _PendingPaymentPanel({
    required this.transaction,
    required this.onOpenPaymentUrl,
    required this.onCheckPayment,
  });

  final PaymentTransaction transaction;
  final ValueChanged<String> onOpenPaymentUrl;
  final ValueChanged<String> onCheckPayment;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    final qrCodeUrl = transaction.qrCodeUrl;
    final paymentUrl = transaction.paymentUrl;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.primaryContainer.withAlpha(80),
        border: Border.all(color: colors.primary),
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            localizations.completePayment,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(localizations.paymentQrInstruction),
          if (qrCodeUrl != null && qrCodeUrl.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final size = math.min(constraints.maxWidth, 240.0);
                return Center(
                  child: Semantics(
                    label: localizations.paymentQrCode,
                    image: true,
                    child: SafeNetworkImage(
                      url: qrCodeUrl,
                      width: size,
                      height: size,
                      fit: BoxFit.contain,
                      borderRadius: AppSpacing.borderRadiusSmall,
                    ),
                  ),
                );
              },
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          if (paymentUrl != null && paymentUrl.isNotEmpty) ...[
            VnSecondaryButton(
              onPressed: () => onOpenPaymentUrl(paymentUrl),
              label: localizations.openPaymentApp,
              icon: const Icon(Icons.open_in_new),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          VnPrimaryButton(
            onPressed: () => onCheckPayment(transaction.id),
            label: localizations.checkPaymentStatus,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
    );
  }
}

class _PaymentFailedPanel extends StatelessWidget {
  const _PaymentFailedPanel({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: _InlineState(
        icon: Icons.error_outline,
        title: localizations.checkoutPaymentFailed,
        actionLabel: localizations.payNow,
        onAction: onRetry,
      ),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.actionIcon = Icons.refresh,
    this.onAction,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final IconData actionIcon;
  final VoidCallback? onAction;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        margin: compact
            ? const EdgeInsets.only(bottom: AppSpacing.xs)
            : EdgeInsets.zero,
        padding: EdgeInsets.all(compact ? AppSpacing.sm : AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surfaceContainerLow,
          border: Border.all(color: colors.outlineVariant),
          borderRadius: AppSpacing.borderRadiusSmall,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: compact ? 28 : 36, color: colors.onSurfaceVariant),
            const SizedBox(height: AppSpacing.xs),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (message != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: onAction,
                icon: Icon(actionIcon),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CheckoutLoadingView extends StatelessWidget {
  const _CheckoutLoadingView();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  localizations.loading,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                const AddressCardSkeleton(),
                const SizedBox(height: AppSpacing.lg),
                const ShippingMethodCardSkeleton(),
                const SizedBox(height: AppSpacing.lg),
                const PaymentMethodCardSkeleton(),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _BlockingCheckoutError extends StatelessWidget {
  const _BlockingCheckoutError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: _InlineState(
          icon: Icons.error_outline,
          title: localizations.checkoutInitializeError,
          actionLabel: localizations.retry,
          onAction: onRetry,
        ),
      ),
    );
  }
}

class _EmptyCheckoutState extends StatelessWidget {
  const _EmptyCheckoutState();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: _InlineState(
          icon: Icons.shopping_cart_outlined,
          title: localizations.checkoutEmptyTitle,
          message: localizations.checkoutEmptyHelp,
          actionLabel: localizations.backToCart,
          actionIcon: Icons.arrow_back,
          onAction: () => context.go(AppRoutes.cart),
        ),
      ),
    );
  }
}
