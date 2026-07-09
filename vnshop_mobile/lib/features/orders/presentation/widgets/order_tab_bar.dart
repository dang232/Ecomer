import 'package:flutter/material.dart';

import '../../data/models/order_model.dart';
import 'order_status_badge.dart';

class OrderTabBar extends StatelessWidget {
  final OrderStatus? selectedStatus;
  final int pendingCount;
  final int confirmedCount;
  final int shippedCount;
  final int deliveredCount;
  final int cancelledCount;
  final ValueChanged<OrderStatus?> onStatusChanged;

  const OrderTabBar({
    super.key,
    this.selectedStatus,
    this.pendingCount = 0,
    this.confirmedCount = 0,
    this.shippedCount = 0,
    this.deliveredCount = 0,
    this.cancelledCount = 0,
    required this.onStatusChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          _buildChip(
            context,
            label: 'Tất cả',
            isSelected: selectedStatus == null,
            onTap: () => onStatusChanged(null),
          ),
          const SizedBox(width: 8),
          _buildChip(
            context,
            status: OrderStatus.pending,
            label: 'Chờ xác nhận',
            count: pendingCount,
            isSelected: selectedStatus == OrderStatus.pending,
            onTap: () => onStatusChanged(OrderStatus.pending),
          ),
          const SizedBox(width: 8),
          _buildChip(
            context,
            status: OrderStatus.confirmed,
            label: 'Đã xác nhận',
            count: confirmedCount,
            isSelected: selectedStatus == OrderStatus.confirmed,
            onTap: () => onStatusChanged(OrderStatus.confirmed),
          ),
          const SizedBox(width: 8),
          _buildChip(
            context,
            status: OrderStatus.shipped,
            label: 'Đang giao',
            count: shippedCount,
            isSelected: selectedStatus == OrderStatus.shipped,
            onTap: () => onStatusChanged(OrderStatus.shipped),
          ),
          const SizedBox(width: 8),
          _buildChip(
            context,
            status: OrderStatus.delivered,
            label: 'Hoàn thành',
            count: deliveredCount,
            isSelected: selectedStatus == OrderStatus.delivered,
            onTap: () => onStatusChanged(OrderStatus.delivered),
          ),
          const SizedBox(width: 8),
          _buildChip(
            context,
            status: OrderStatus.cancelled,
            label: 'Đã hủy',
            count: cancelledCount,
            isSelected: selectedStatus == OrderStatus.cancelled,
            onTap: () => onStatusChanged(OrderStatus.cancelled),
          ),
        ],
      ),
    );
  }

  Widget _buildChip(
    BuildContext context, {
    OrderStatus? status,
    required String label,
    int count = 0,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return OrderStatusChip(
      status: status,
      label: label,
      count: count,
      isSelected: isSelected,
      onTap: onTap,
    );
  }
}
