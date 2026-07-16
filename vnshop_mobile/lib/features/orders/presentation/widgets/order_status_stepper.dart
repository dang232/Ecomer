import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/order_model.dart';
import '../mappers/order_presentation_mapper.dart';

class OrderStatusStepper extends StatelessWidget {
  const OrderStatusStepper({required this.currentStatus, super.key});

  final OrderStatus currentStatus;

  static const _steps = <OrderStatus>[
    OrderStatus.pending,
    OrderStatus.confirmed,
    OrderStatus.shipped,
    OrderStatus.delivered,
  ];

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    if (currentStatus == OrderStatus.cancelled) {
      return Semantics(
        liveRegion: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(currentStatus.icon, color: currentStatus.color),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                currentStatus.localizedLabel(localizations),
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(color: currentStatus.color),
              ),
            ),
          ],
        ),
      );
    }

    final currentIndex = currentStatus.progressIndex;
    return Column(
      children: [
        for (var index = 0; index < _steps.length; index++)
          _ProgressStep(
            label: _steps[index].localizedLabel(localizations),
            icon: _steps[index].icon,
            completed: index < currentIndex,
            active: index == currentIndex,
            showConnector: index < _steps.length - 1,
          ),
      ],
    );
  }
}

class _ProgressStep extends StatelessWidget {
  const _ProgressStep({
    required this.label,
    required this.icon,
    required this.completed,
    required this.active,
    required this.showConnector,
  });

  final String label;
  final IconData icon;
  final bool completed;
  final bool active;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = completed
        ? theme.colorScheme.tertiary
        : active
        ? theme.colorScheme.primary
        : theme.colorScheme.outline;
    final foreground = completed || active
        ? theme.colorScheme.onPrimary
        : theme.colorScheme.onSurfaceVariant;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 40,
          child: Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: completed || active
                      ? color
                      : theme.colorScheme.surfaceContainerHighest,
                  shape: BoxShape.circle,
                  border: Border.all(color: color),
                ),
                child: Icon(
                  completed ? Icons.check : icon,
                  size: 18,
                  color: foreground,
                ),
              ),
              if (showConnector)
                Container(
                  width: 2,
                  height: AppSpacing.lg,
                  color: completed
                      ? theme.colorScheme.tertiary
                      : theme.colorScheme.outlineVariant,
                ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4, bottom: AppSpacing.md),
            child: Text(
              label,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: active || completed
                    ? theme.colorScheme.onSurface
                    : theme.colorScheme.onSurfaceVariant,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
