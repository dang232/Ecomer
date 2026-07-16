import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../core/design_system/components/async_state_view.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../bloc/order_list_bloc.dart';
import '../mappers/order_presentation_mapper.dart';
import '../models/order_failure.dart';
import '../widgets/order_card.dart';
import '../widgets/order_tab_bar.dart';

class OrderListPage extends StatefulWidget {
  const OrderListPage({super.key});

  @override
  State<OrderListPage> createState() => _OrderListPageState();
}

class _OrderListPageState extends State<OrderListPage> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    context.read<OrderListBloc>().add(const LoadOrdersEvent());
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 240) {
      context.read<OrderListBloc>().add(const LoadMoreOrdersEvent());
    }
  }

  Future<void> _refresh(OrderListState state) async {
    final bloc = context.read<OrderListBloc>();
    bloc.add(
      LoadOrdersEvent(forceRefresh: true, statusFilter: state.statusFilter),
    );
    await bloc.stream.firstWhere(
      (next) =>
          next.status == OrderListStatus.loaded ||
          next.status == OrderListStatus.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(localizations.myOrders)),
      body: BlocConsumer<OrderListBloc, OrderListState>(
        listenWhen: (previous, current) =>
            previous.status != current.status ||
            previous.failure != current.failure,
        listener: (context, state) {
          if (state.status == OrderListStatus.cancelled) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(localizations.orderCancelledSuccess)),
            );
          } else if (state.failure != null && state.orders.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.failure!.localizedMessage(localizations)),
              ),
            );
          }
        },
        builder: (context, state) {
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.screenPadding,
                      AppSpacing.sm,
                      AppSpacing.screenPadding,
                      0,
                    ),
                    child: Text(
                      localizations.orderListCount(state.totalElements),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  OrderTabBar(
                    selectedStatus: state.statusFilter,
                    onStatusChanged: (status) {
                      context.read<OrderListBloc>().add(
                        ChangeStatusFilterEvent(status),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  Expanded(child: _buildContent(context, state)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildContent(BuildContext context, OrderListState state) {
    final localizations = AppLocalizations.of(context);
    final status = resolveAsyncViewStatus(
      isLoading: state.status == OrderListStatus.loading,
      hasError: state.status == OrderListStatus.error,
      isEmpty: state.status == OrderListStatus.loaded && state.orders.isEmpty,
      hasData: state.orders.isNotEmpty,
    );

    return AsyncStateView(
      status: status,
      loading: const _OrderListSkeleton(),
      error: _OrderMessage(
        icon: Icons.cloud_off_outlined,
        title: localizations.ordersLoadError,
        message: (state.failure ?? OrderFailure.unknown).localizedMessage(
          localizations,
        ),
      ),
      empty: _OrderEmptyState(filtered: state.statusFilter != null),
      retryLabel: localizations.retry,
      onRetry: () => context.read<OrderListBloc>().add(
        LoadOrdersEvent(statusFilter: state.statusFilter),
      ),
      child: RefreshIndicator(
        onRefresh: () => _refresh(state),
        child: ListView.builder(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(
            top: AppSpacing.xs,
            bottom: AppSpacing.lg,
          ),
          itemCount:
              state.orders.length +
              (state.status == OrderListStatus.loadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == state.orders.length) {
              return const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final order = state.orders[index];
            return OrderCard(
              order: order,
              isCancelling: state.cancellingOrderId == order.id,
              onTap: () => context.push(AppRoutes.orderDetail(order.id)),
            );
          },
        ),
      ),
    );
  }
}

class _OrderEmptyState extends StatelessWidget {
  const _OrderEmptyState({required this.filtered});

  final bool filtered;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return _OrderMessage(
      icon: Icons.receipt_long_outlined,
      title: filtered
          ? localizations.orderEmptyFilteredTitle
          : localizations.emptyOrders,
      message: filtered
          ? localizations.orderEmptyFilteredHelp
          : localizations.orderEmptyHelp,
      action: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 280),
        child: VnButton(
          onPressed: () => context.go(AppRoutes.home),
          label: localizations.continueShopping,
          icon: const Icon(Icons.shopping_bag_outlined),
        ),
      ),
    );
  }
}

class _OrderMessage extends StatelessWidget {
  const _OrderMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class _OrderListSkeleton extends StatelessWidget {
  const _OrderListSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return ListView.builder(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      itemCount: 3,
      itemBuilder: (context, index) => Container(
        height: 180,
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        decoration: BoxDecoration(
          color: color,
          borderRadius: AppSpacing.borderRadiusSmall,
        ),
      ),
    );
  }
}
