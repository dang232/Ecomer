import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';

/// Nút bấm chung của VNShop với animation scale-on-press (0.96)
/// Tuân thủ nguyên tắc make-interfaces-feel-better
///
/// Các loại nút:
/// - primary: Nút chính có nền màu
/// - secondary: Nút phụ dạng outlined
/// - text: Nút dạng text không viền
class VnButton extends StatefulWidget {
  const VnButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.type = VnButtonType.primary,
    this.isLoading = false,
    this.icon,
    this.isFullWidth = true,
    this.height = 52,
    this.backgroundColor,
    this.foregroundColor,
    this.disabledColor,
    this.static = false,
  });

  /// Callback khi nhấn nút
  final VoidCallback? onPressed;

  /// Nhãn hiển thị trên nút (mặc định tiếng Việt)
  final String label;

  /// Loại nút: primary, secondary, text
  final VnButtonType type;

  /// Trạng thái loading
  final bool isLoading;

  /// Icon hiển thị bên trái nhãn
  final Widget? icon;

  /// Chiếm toàn bộ chiều rộng
  final bool isFullWidth;

  /// Chiều cao nút
  final double height;

  /// Màu nền tùy chỉnh
  final Color? backgroundColor;

  /// Màu chữ/icon tùy chỉnh
  final Color? foregroundColor;

  /// Màu nền khi bị disabled
  final Color? disabledColor;

  /// Tắt animation khi motion gây phiền
  final bool static;

  @override
  State<VnButton> createState() => _VnButtonState();
}

enum VnButtonType { primary, secondary, text }

class _VnButtonState extends State<VnButton>
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
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.96), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.96, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
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

  ButtonStyle _getButtonStyle(ThemeData theme) {
    switch (widget.type) {
      case VnButtonType.secondary:
        return OutlinedButton.styleFrom(
          minimumSize: Size(
            widget.isFullWidth ? double.infinity : 0,
            widget.height,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: AppSpacing.borderRadiusSmall,
          ),
          side: BorderSide(
            color: widget.backgroundColor ?? theme.colorScheme.primary,
            width: 1.5,
          ),
        );
      case VnButtonType.text:
        return TextButton.styleFrom(
          minimumSize: Size(
            widget.isFullWidth ? double.infinity : 0,
            widget.height,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: AppSpacing.borderRadiusSmall,
          ),
        );
      case VnButtonType.primary:
        return ElevatedButton.styleFrom(
          minimumSize: Size(
            widget.isFullWidth ? double.infinity : 0,
            widget.height,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          backgroundColor: widget.backgroundColor,
          foregroundColor: widget.foregroundColor,
          disabledBackgroundColor: widget.disabledColor,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: AppSpacing.borderRadiusSmall,
          ),
        );
    }
  }

  Color _getForegroundColor(ThemeData theme) {
    if (widget.foregroundColor != null) {
      return widget.foregroundColor!;
    }
    switch (widget.type) {
      case VnButtonType.secondary:
      case VnButtonType.text:
        return widget.backgroundColor ?? theme.colorScheme.primary;
      case VnButtonType.primary:
        return theme.colorScheme.onPrimary;
    }
  }

  Widget _buildButtonContent(ThemeData theme) {
    if (widget.isLoading) {
      return SizedBox(
        height: 24,
        width: 24,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          valueColor: AlwaysStoppedAnimation<Color>(_getForegroundColor(theme)),
        ),
      );
    }

    if (widget.icon != null) {
      final label = Text(
        widget.label,
        textAlign: TextAlign.center,
        style: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: _getForegroundColor(theme),
        ),
      );
      return Row(
        mainAxisSize: widget.isFullWidth ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          widget.icon!,
          const SizedBox(width: 8),
          if (widget.isFullWidth) Expanded(child: label) else label,
        ],
      );
    }

    return Text(
      widget.label,
      style: theme.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: _getForegroundColor(theme),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final buttonStyle = _getButtonStyle(theme);
    final isDisabled = widget.onPressed == null || widget.isLoading;

    Widget button;
    switch (widget.type) {
      case VnButtonType.secondary:
        button = OutlinedButton(
          onPressed: isDisabled ? null : widget.onPressed,
          style: buttonStyle,
          child: _buildButtonContent(theme),
        );
        break;
      case VnButtonType.text:
        button = TextButton(
          onPressed: isDisabled ? null : widget.onPressed,
          style: buttonStyle,
          child: _buildButtonContent(theme),
        );
        break;
      case VnButtonType.primary:
        button = ElevatedButton(
          onPressed: isDisabled ? null : widget.onPressed,
          style: buttonStyle,
          child: _buildButtonContent(theme),
        );
    }

    return AnimatedBuilder(
      animation: _scaleAnimation,
      builder: (context, child) =>
          Transform.scale(scale: _scaleAnimation.value, child: child),
      child: GestureDetector(
        onTapDown: !isDisabled ? _onTapDown : null,
        onTapUp: !isDisabled ? _onTapUp : null,
        onTapCancel: !isDisabled ? _onTapCancel : null,
        child: button,
      ),
    );
  }
}

/// Nút chính (Primary Button) - giữ backward compatibility
class VnPrimaryButton extends StatelessWidget {
  const VnPrimaryButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.icon,
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
  final bool isFullWidth;
  final double height;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Color? disabledColor;
  final bool static;

  @override
  Widget build(BuildContext context) {
    return VnButton(
      onPressed: onPressed,
      label: label,
      type: VnButtonType.primary,
      isLoading: isLoading,
      icon: icon,
      isFullWidth: isFullWidth,
      height: height,
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      disabledColor: disabledColor,
      static: static,
    );
  }
}

/// Nút phụ (Secondary Button) - giữ backward compatibility
class VnSecondaryButton extends StatelessWidget {
  const VnSecondaryButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.icon,
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
  final bool isFullWidth;
  final double height;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Color? disabledColor;
  final bool static;

  @override
  Widget build(BuildContext context) {
    return VnButton(
      onPressed: onPressed,
      label: label,
      type: VnButtonType.secondary,
      isLoading: isLoading,
      icon: icon,
      isFullWidth: isFullWidth,
      height: height,
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      disabledColor: disabledColor,
      static: static,
    );
  }
}

/// Nút text (Text Button) - giữ backward compatibility
class VnTextButton extends StatelessWidget {
  const VnTextButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.icon,
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
  final bool isFullWidth;
  final double height;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Color? disabledColor;
  final bool static;

  @override
  Widget build(BuildContext context) {
    return VnButton(
      onPressed: onPressed,
      label: label,
      type: VnButtonType.text,
      isLoading: isLoading,
      icon: icon,
      isFullWidth: isFullWidth,
      height: height,
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      disabledColor: disabledColor,
      static: static,
    );
  }
}
