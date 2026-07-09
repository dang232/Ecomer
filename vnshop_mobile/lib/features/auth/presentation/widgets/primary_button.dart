import 'package:flutter/material.dart';

/// Primary button widget with loading state and scale-on-press animation
/// Follows make-interfaces-feel-better principles
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.icon,
    this.isOutlined = false,
    this.isText = false,
    this.isFullWidth = true,
    this.height = 52,
    this.backgroundColor,
    this.foregroundColor,
    this.disabledColor,
    this.static = false,
  });

  final VoidCallback? onPressed;
  final String label;
  final bool isLoading;
  final Widget? icon;
  final bool isOutlined;
  final bool isText;
  final bool isFullWidth;
  final double height;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Color? disabledColor;
  /// Disable scale animation when motion would be distracting
  final bool static;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton>
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
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.96).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    if (!widget.static) {
      _controller.forward();
    }
  }

  void _onTapUp(TapUpDetails details) {
    if (!widget.static) {
      _controller.reverse();
    }
  }

  void _onTapCancel() {
    if (!widget.static) {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final buttonStyle = widget.isOutlined
        ? OutlinedButton.styleFrom(
            minimumSize: Size(widget.isFullWidth ? double.infinity : 0, widget.height),
            padding: const EdgeInsets.symmetric(horizontal: 24),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            side: BorderSide(
              color: widget.backgroundColor ?? theme.colorScheme.primary,
              width: 1.5,
            ),
          )
        : widget.isText
            ? TextButton.styleFrom(
                minimumSize: Size(widget.isFullWidth ? double.infinity : 0, widget.height),
                padding: const EdgeInsets.symmetric(horizontal: 24),
              )
            : ElevatedButton.styleFrom(
                minimumSize: Size(widget.isFullWidth ? double.infinity : 0, widget.height),
                padding: const EdgeInsets.symmetric(horizontal: 24),
                backgroundColor: widget.backgroundColor,
                foregroundColor: widget.foregroundColor,
                disabledBackgroundColor: widget.disabledColor,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              );

    final Widget buttonChild;

    if (widget.isLoading) {
      buttonChild = SizedBox(
        height: 24,
        width: 24,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          valueColor: AlwaysStoppedAnimation<Color>(
            widget.isOutlined || widget.isText
                ? theme.colorScheme.primary
                : theme.colorScheme.onPrimary,
          ),
        ),
      );
    } else if (widget.icon != null) {
      buttonChild = Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          widget.icon!,
          const SizedBox(width: 8),
          Text(
            widget.label,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: widget.isOutlined || widget.isText
                  ? widget.backgroundColor ?? theme.colorScheme.primary
                  : theme.colorScheme.onPrimary,
            ),
          ),
        ],
      );
    } else {
      buttonChild = Text(
        widget.label,
        style: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: widget.isOutlined || widget.isText
              ? widget.backgroundColor ?? theme.colorScheme.primary
              : theme.colorScheme.onPrimary,
        ),
      );
    }

    Widget button;
    if (widget.isOutlined) {
      button = OutlinedButton(
        onPressed: widget.isLoading ? null : widget.onPressed,
        style: buttonStyle,
        child: buttonChild,
      );
    } else if (widget.isText) {
      button = TextButton(
        onPressed: widget.isLoading ? null : widget.onPressed,
        style: buttonStyle,
        child: buttonChild,
      );
    } else {
      button = ElevatedButton(
        onPressed: widget.isLoading ? null : widget.onPressed,
        style: buttonStyle,
        child: buttonChild,
      );
    }

    // Apply scale-on-press animation
    return AnimatedBuilder(
      animation: _scaleAnimation,
      builder: (context, child) => Transform.scale(
        scale: _scaleAnimation.value,
        child: child,
      ),
      child: GestureDetector(
        onTapDown: widget.onPressed != null && !widget.isLoading ? _onTapDown : null,
        onTapUp: widget.onPressed != null && !widget.isLoading ? _onTapUp : null,
        onTapCancel: widget.onPressed != null && !widget.isLoading ? _onTapCancel : null,
        child: button,
      ),
    );
  }
}
