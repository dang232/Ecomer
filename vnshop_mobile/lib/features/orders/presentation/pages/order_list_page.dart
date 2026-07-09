import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/order_model.dart';
import '../bloc/order_list_bloc.dart';
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
    // Load orders on init
    context.read<OrderListBloc>().add(const LoadOrdersEvent());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isBottom) {
      context.read<OrderListBloc>().add(const LoadMoreOrdersEvent());
    }
  }

  bool get _isBottom {
    if (!_scrollController.hasClients) return false;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    return currentScroll >= (maxScroll * 0.9);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn hàng của tôi'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: BlocConsumer<OrderListBloc, OrderListState>(
        listener: (context, state) {
          if (state.status == OrderListStatus.cancelled) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đơn hàng đã được hủy thành công'),
                backgroundColor: Colors.green,
              ),
            );
          } else if (state.status == OrderListStatus.error &&
              state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage!),
                backgroundColor: Colors.red,
              ),
            );
          }
        },
        builder: (context, state) {
          return Column(
            children: [
              // Tab bar for filtering
              OrderTabBar(
                selectedStatus: state.statusFilter,
                pendingCount: state.pendingCount,
                confirmedCount: state.confirmedCount,
                shippedCount: state.shippedCount,
                deliveredCount: state.deliveredCount,
                cancelledCount: state.cancelledCount,
                onStatusChanged: (status) {
                  context
                      .read<OrderListBloc>()
                      .add(ChangeStatusFilterEvent(status));
                },
              ),

              // Order list
              Expanded(
                child: _buildOrderList(context, state),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOrderList(BuildContext context, OrderListState state) {
    if (state.status == OrderListStatus.loading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (state.status == OrderListStatus.error && state.orders.isEmpty) {
      return _buildErrorWidget(context, state.errorMessage);
    }

    final orders = state.filteredOrders;

    if (orders.isEmpty) {
      return _buildEmptyWidget(context, state.statusFilter);
    }

    return RefreshIndicator(
      onRefresh: () async {
        context
            .read<OrderListBloc>()
            .add(LoadOrdersEvent(forceRefresh: true, statusFilter: state.statusFilter));
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.only(top: 8, bottom: 16),
        itemCount: orders.length + (state.hasReachedMax ? 0 : 1),
        itemBuilder: (context, index) {
          if (index >= orders.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(
                child: CircularProgressIndicator(),
              ),
            );
          }

          final order = orders[index];
          return OrderCard(
            order: order,
            isCancelling: state.cancellingOrderId == order.id,
            onTap: () => context.push('/orders/${order.id}'),
          );
        },
      ),
    );
  }

  Widget _buildEmptyWidget(BuildContext context, OrderStatus? statusFilter) {
    String message;
    IconData icon;

    if (statusFilter != null) {
      switch (statusFilter) {
        case OrderStatus.pending:
          message = 'Không có đơn hàng chờ xác nhận';
          break;
        case OrderStatus.confirmed:
          message = 'Không có đơn hàng đã xác nhận';
          break;
        case OrderStatus.processing:
          message = 'Không có đơn hàng đang xử lý';
          break;
        case OrderStatus.shipped:
          message = 'Không có đơn hàng đang giao';
          break;
        case OrderStatus.delivered:
          message = 'Không có đơn hàng đã giao';
          break;
        case OrderStatus.cancelled:
          message = 'Không có đơn hàng đã hủy';
          break;
      }
    } else {
      message = 'Bạn chưa có đơn hàng nào';
    }

    icon = Icons.receipt_long_outlined;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 80,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey.shade600,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Hãy bắt đầu mua sắm ngay!',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => context.go('/'),
            icon: const Icon(Icons.shopping_bag_outlined),
            label: const Text('Tiếp tục mua sắm'),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget(BuildContext context, String? errorMessage) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 80,
              color: Colors.red.shade300,
            ),
            const SizedBox(height: 16),
            Text(
              'Đã xảy ra lỗi',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              errorMessage ?? 'Vui lòng thử lại sau',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                context.read<OrderListBloc>().add(const LoadOrdersEvent());
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }
}
