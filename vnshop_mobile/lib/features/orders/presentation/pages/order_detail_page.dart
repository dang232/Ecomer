import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../core/design_system/components/async_state_view.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/localized_formatters.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/order_item_model.dart';
import '../../data/models/order_model.dart';
import '../bloc/order_detail_cubit.dart';
import '../mappers/order_presentation_mapper.dart';
import '../models/order_failure.dart';
import '../widgets/order_status_badge.dart';
import '../widgets/order_status_stepper.dart';

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({required this.orderId, super.key});

  final String orderId;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  @override
  void initState() {
    super.initState();
    context.read<OrderDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Scaffold(
      restorationId: 'order-detail-${widget.orderId}',
      appBar: AppBar(title: Text(localizations.orderDetailTitle)),
      body: BlocConsumer<OrderDetailCubit, OrderDetailState>(
        listenWhen: (previous, current) =>
            previous.status != current.status ||
            previous.failure != current.failure,
        listener: (context, state) {
          if (state.status == OrderDetailStatus.cancelled) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(localizations.orderCancelledSuccess)),
            );
          } else if (state.failure != null && state.order != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.failure!.localizedMessage(localizations)),
              ),
            );
          }
        },
        builder: (context, state) {
          if (state.order != null) {
            return _OrderDetailContent(order: state.order!);
          }
          final status = resolveAsyncViewStatus(
            isLoading:
                state.status == OrderDetailStatus.initial ||
                state.status == OrderDetailStatus.loading,
            hasError: state.status == OrderDetailStatus.error,
            isEmpty: false,
            hasData: false,
          );
          return AsyncStateView(
            status: status,
            loading: const _OrderDetailSkeleton(),
            error: _DetailMessage(
              icon: state.failure == OrderFailure.notFound
                  ? Icons.receipt_long_outlined
                  : Icons.cloud_off_outlined,
              title: state.failure == OrderFailure.notFound
                  ? localizations.orderNotFoundError
                  : localizations.ordersLoadError,
              message: (state.failure ?? OrderFailure.unknown).localizedMessage(
                localizations,
              ),
            ),
            empty: const SizedBox.shrink(),
            retryLabel: localizations.retry,
            onRetry: context.read<OrderDetailCubit>().load,
            child: const SizedBox.shrink(),
          );
        },
      ),
      bottomNavigationBar: BlocBuilder<OrderDetailCubit, OrderDetailState>(
        builder: (context, state) {
          final order = state.order;
          if (order == null || !order.canCancel) return const SizedBox.shrink();
          return SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.screenPadding),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border(
                  top: BorderSide(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
              ),
              child: VnButton(
                key: const Key('order-detail-cancel'),
                onPressed: state.status == OrderDetailStatus.cancelling
                    ? null
                    : () => _confirmCancellation(context),
                label: state.status == OrderDetailStatus.cancelling
                    ? localizations.cancellingOrder
                    : localizations.cancelOrder,
                type: VnButtonType.secondary,
                icon: const Icon(Icons.cancel_outlined),
                isLoading: state.status == OrderDetailStatus.cancelling,
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmCancellation(BuildContext context) async {
    final localizations = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(localizations.cancelOrderTitle),
        content: Text(localizations.cancelOrderConfirmation),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(localizations.keepOrder),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
            child: Text(localizations.confirmCancelOrder),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await context.read<OrderDetailCubit>().cancel();
    }
  }
}

class _OrderDetailContent extends StatelessWidget {
  const _OrderDetailContent({required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return SingleChildScrollView(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DetailSection(
                title: localizations.orderStatusSection,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OrderStatusBadge(status: order.status, large: true),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      order.orderNumber,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    OrderStatusStepper(currentStatus: order.status),
                    if (order.trackingNumber != null ||
                        order.carrier != null ||
                        order.shippingMethod != null) ...[
                      const Divider(height: AppSpacing.xl),
                      if (order.trackingNumber != null)
                        _InfoBlock(
                          label: localizations.trackingNumber,
                          value: order.trackingNumber!,
                        ),
                      if (order.carrier != null)
                        _InfoBlock(
                          label: localizations.carrier,
                          value: order.carrier!,
                        ),
                      if (order.shippingMethod != null)
                        _InfoBlock(
                          label: localizations.shippingMethod,
                          value: order.shippingMethod!,
                        ),
                    ],
                  ],
                ),
              ),
              if (order.fullShippingAddress.isNotEmpty)
                _DetailSection(
                  title: localizations.deliveryAddress,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          order.fullShippingAddress,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                    ],
                  ),
                ),
              _DetailSection(
                title: localizations.orderProducts,
                child: order.items.isEmpty
                    ? Text(
                        localizations.orderProductsUnavailable,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      )
                    : Column(
                        children: [
                          for (
                            var index = 0;
                            index < order.items.length;
                            index++
                          ) ...[
                            if (index > 0) const Divider(height: AppSpacing.lg),
                            _OrderItemLine(item: order.items[index]),
                          ],
                        ],
                      ),
              ),
              _DetailSection(
                title: localizations.orderSummary,
                child: Column(
                  children: [
                    _AmountRow(
                      label: localizations.subtotal,
                      amount: order.subtotal,
                    ),
                    _AmountRow(
                      label: localizations.shipping,
                      amount: order.shippingFee,
                    ),
                    if (order.discount > 0)
                      _AmountRow(
                        label: localizations.discount,
                        amount: -order.discount,
                        accent: Theme.of(context).colorScheme.tertiary,
                      ),
                    const Divider(height: AppSpacing.lg),
                    _AmountRow(
                      label: localizations.total,
                      amount: order.totalAmount,
                      emphasized: true,
                    ),
                  ],
                ),
              ),
              _DetailSection(
                title: localizations.paymentInformation,
                child: Column(
                  children: [
                    _InfoBlock(
                      label: localizations.paymentMethod,
                      value: localizedPaymentMethod(
                        order.paymentMethod,
                        localizations,
                      ),
                    ),
                    _InfoBlock(
                      label: localizations.paymentStatus,
                      value: order.isPaid
                          ? localizations.paid
                          : localizations.unpaid,
                      valueColor: order.isPaid
                          ? Theme.of(context).colorScheme.tertiary
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ],
                ),
              ),
              _DetailSection(
                title: localizations.orderInformation,
                showBottomBorder: false,
                child: Column(
                  children: [
                    _InfoBlock(
                      label: localizations.orderCode,
                      value: order.orderNumber,
                    ),
                    if (order.hasCreatedAt)
                      _InfoBlock(
                        label: localizations.placedAt,
                        value: LocalizedFormatters.dateTime(
                          context,
                          order.createdAt,
                        ),
                      ),
                    if (order.updatedAt != null)
                      _InfoBlock(
                        label: localizations.updatedAt,
                        value: LocalizedFormatters.dateTime(
                          context,
                          order.updatedAt!,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({
    required this.title,
    required this.child,
    this.showBottomBorder = true,
  });

  final String title;
  final Widget child;
  final bool showBottomBorder;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: showBottomBorder
            ? Border(
                bottom: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              )
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _OrderItemLine extends StatelessWidget {
  const _OrderItemLine({required this.item});

  final OrderItemModel item;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SafeNetworkImage(
            url: item.productImage,
            width: 72,
            height: 72,
            borderRadius: AppSpacing.borderRadiusSmall,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                if (item.variantSku != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    item.variantSku!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  localizations.quantityShort(item.quantity),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  LocalizedFormatters.currency(context, item.totalPrice),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
          if (item.productId.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: AppSpacing.xs),
              child: Icon(Icons.chevron_right),
            ),
        ],
      ),
    );

    if (item.productId.isEmpty) return content;
    return Semantics(
      button: true,
      child: InkWell(
        onTap: () => context.push(AppRoutes.productDetail(item.productId)),
        borderRadius: AppSpacing.borderRadiusSmall,
        child: content,
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.amount,
    this.accent,
    this.emphasized = false,
  });

  final String label;
  final double amount;
  final Color? accent;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: emphasized
                  ? theme.textTheme.titleMedium
                  : theme.textTheme.bodyMedium,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              LocalizedFormatters.currency(context, amount),
              textAlign: TextAlign.end,
              style:
                  (emphasized
                          ? theme.textTheme.titleLarge
                          : theme.textTheme.bodyMedium)
                      ?.copyWith(
                        color:
                            accent ??
                            (emphasized ? theme.colorScheme.primary : null),
                        fontWeight: emphasized
                            ? FontWeight.w700
                            : FontWeight.w600,
                      ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            label,
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            value,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailMessage extends StatelessWidget {
  const _DetailMessage({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 48,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderDetailSkeleton extends StatelessWidget {
  const _OrderDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(
            children: [
              for (final height in <double>[220, 120, 240, 180]) ...[
                Container(
                  height: height,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: AppSpacing.borderRadiusSmall,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
