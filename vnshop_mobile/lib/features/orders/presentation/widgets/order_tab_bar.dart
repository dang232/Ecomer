import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/order_model.dart';
import '../mappers/order_presentation_mapper.dart';

class OrderTabBar extends StatelessWidget {
  const OrderTabBar({
    required this.selectedStatus,
    required this.onStatusChanged,
    super.key,
  });

  final OrderStatus? selectedStatus;
  final ValueChanged<OrderStatus?> onStatusChanged;

  static const _statuses = <OrderStatus?>[
    null,
    OrderStatus.pending,
    OrderStatus.confirmed,
    OrderStatus.shipped,
    OrderStatus.delivered,
    OrderStatus.cancelled,
  ];

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.screenPadding,
        vertical: AppSpacing.xs,
      ),
      child: Row(
        children: [
          for (var index = 0; index < _statuses.length; index++) ...[
            if (index > 0) const SizedBox(width: AppSpacing.xs),
            _StatusChoice(
              label:
                  _statuses[index]?.localizedLabel(localizations) ??
                  localizations.orderAll,
              selected: selectedStatus == _statuses[index],
              onSelected: () => onStatusChanged(_statuses[index]),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusChoice extends StatelessWidget {
  const _StatusChoice({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: ChoiceChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => onSelected(),
          showCheckmark: false,
          shape: RoundedRectangleBorder(
            borderRadius: AppSpacing.borderRadiusSmall,
          ),
          labelStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: selected
                ? Theme.of(context).colorScheme.onPrimary
                : Theme.of(context).colorScheme.onSurface,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
          selectedColor: Theme.of(context).colorScheme.primary,
          backgroundColor: Theme.of(context).colorScheme.surface,
          side: BorderSide(
            color: selected
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
    );
  }
}
