import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// A quantity stepper widget with +/- buttons for cart item quantity control.
/// Features scale animation on quantity change.
class QuantityStepper extends StatefulWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onChanged,
    this.minValue = 1,
    this.maxValue = 99,
    this.enabled = true,
  });

  /// Current quantity value
  final int quantity;

  /// Callback when quantity changes
  final ValueChanged<int> onChanged;

  /// Minimum allowed quantity (default: 1)
  final int minValue;

  /// Maximum allowed quantity (default: 99)
  final int maxValue;

  /// Whether the stepper is enabled
  final bool enabled;

  @override
  State<QuantityStepper> createState() => _QuantityStepperState();
}

class _QuantityStepperState extends State<QuantityStepper> {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: Navigator.of(context),
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.9), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void didUpdateWidget(QuantityStepper oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.quantity != widget.quantity) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleChange(int newQuantity) {
    if (!widget.enabled) return;
    if (newQuantity >= widget.minValue && newQuantity <= widget.maxValue) {
      widget.onChanged(newQuantity);
    }
  }

  bool get _canDecrement => widget.quantity > widget.minValue;
  bool get _canIncrement => widget.quantity < widget.maxValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(
          color: AppColors.outlineVariant,
          width: 1,
        ),
        borderRadius: AppSpacing.borderRadiusSmall,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Decrement button
          _StepperButton(
            icon: Icons.remove,
            onPressed: _canDecrement && widget.enabled
                ? () => _handleChange(widget.quantity - 1)
                : null,
            onLongPress: _canDecrement && widget.enabled
                ? () {
                    final newQty = widget.quantity > 10
                        ? widget.quantity - 10
                        : widget.minValue;
                    _handleChange(newQty);
                  }
                : null,
          ),
          // Quantity display with scale animation
          ScaleTransition(
            scale: _scaleAnimation,
            child: Container(
              width: 40,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant.withValues(alpha: 0.5),
              ),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                transitionBuilder: (child, animation) {
                  return ScaleTransition(scale: animation, child: child);
                },
                child: Text(
                  widget.quantity.toString(),
                  key: ValueKey<int>(widget.quantity),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurface,
                  ),
                ),
              ),
            ),
          ),
          // Increment button
          _StepperButton(
            icon: Icons.add,
            onPressed: _canIncrement && widget.enabled
                ? () => _handleChange(widget.quantity + 1)
                : null,
            onLongPress: _canIncrement && widget.enabled
                ? () {
                    final newQty = widget.quantity < widget.maxValue - 10
                        ? widget.quantity + 10
                        : widget.maxValue;
                    _handleChange(newQty);
                  }
                : null,
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatefulWidget {
  const _StepperButton({
    required this.icon,
    this.onPressed,
    this.onLongPress,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final VoidCallback? onLongPress;

  @override
  State<_StepperButton> createState() => _StepperButtonState();
}

class _StepperButtonState extends State<_StepperButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.85), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.85, end: 1.0), weight: 50),
    ]).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    if (widget.onPressed != null) {
      _controller.forward();
    }
  }

  void _onTapUp(TapUpDetails details) {
    _controller.reverse();
  }

  void _onTapCancel() {
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final isEnabled = widget.onPressed != null;

    return GestureDetector(
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      onLongPress: widget.onLongPress,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: Material(
          color: isEnabled ? AppColors.surface : AppColors.surfaceVariant,
          borderRadius: AppSpacing.borderRadiusMicro,
          child: InkWell(
            onTap: widget.onPressed,
            borderRadius: AppSpacing.borderRadiusMicro,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xs),
              child: Icon(
                widget.icon,
                size: 18,
                color: isEnabled ? AppColors.primary : AppColors.outline,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
