import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

/// Password field với tính năng toggle visibility
/// Tuân thủ nguyên tắc make-interfaces-feel-better
class VnPasswordField extends StatefulWidget {
  const VnPasswordField({
    super.key,
    required this.controller,
    this.labelText = 'Mật khẩu',
    this.hintText = 'Nhập mật khẩu của bạn',
    this.prefixIcon,
    this.onChanged,
    this.validator,
    this.textInputAction = TextInputAction.done,
    this.autofocus = false,
    this.enabled = true,
    this.onSubmitted,
    this.showStrengthIndicator = true,
    this.minLength = 6,
  });

  /// Controller cho password field
  final TextEditingController? controller;

  /// Nhãn hiển thị
  final String labelText;

  /// Gợi ý nhập liệu
  final String hintText;

  /// Icon phía trước
  final Widget? prefixIcon;

  /// Callback khi text thay đổi
  final ValueChanged<String>? onChanged;

  /// Validator function
  final String? Function(String?)? validator;

  /// Action trên bàn phím
  final TextInputAction textInputAction;

  /// Tự động focus
  final bool autofocus;

  /// Có enable không
  final bool enabled;

  /// Callback khi submit
  final ValueChanged<String>? onSubmitted;

  /// Hiển thị thanh chỉ thị độ mạnh mật khẩu
  final bool showStrengthIndicator;

  /// Độ dài tối thiểu
  final int minLength;

  @override
  State<VnPasswordField> createState() => _VnPasswordFieldState();
}

class _VnPasswordFieldState extends State<VnPasswordField> {
  bool _obscureText = true;
  int _passwordStrength = 0;

  void _toggleVisibility() {
    setState(() {
      _obscureText = !_obscureText;
    });
  }

  void _onChanged(String value) {
    widget.onChanged?.call(value);
    if (widget.showStrengthIndicator) {
      setState(() {
        _passwordStrength = _calculateStrength(value);
      });
    }
  }

  int _calculateStrength(String password) {
    if (password.isEmpty) return 0;
    int strength = 0;

    // Length checks
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    // Character type checks
    if (password.contains(RegExp(r'[a-z]'))) strength++;
    if (password.contains(RegExp(r'[A-Z]'))) strength++;
    if (password.contains(RegExp(r'[0-9]'))) strength++;
    if (password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength++;

    // Normalize to 0-4 scale
    if (strength <= 2) return 1;
    if (strength <= 4) return 2;
    if (strength <= 5) return 3;
    return 4;
  }

  Color _getStrengthColor(int strength) {
    switch (strength) {
      case 1:
        return AppColors.error;
      case 2:
        return AppColors.warning;
      case 3:
        return AppColors.info;
      case 4:
        return AppColors.success;
      default:
        return AppColors.onSurfaceVariant;
    }
  }

  String _getStrengthText(int strength) {
    switch (strength) {
      case 1:
        return 'Yếu';
      case 2:
        return 'Trung bình';
      case 3:
        return 'Khá mạnh';
      case 4:
        return 'Mạnh';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Text(
          widget.labelText,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
            color: theme.colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),

        // Password Field
        TextFormField(
          controller: widget.controller,
          obscureText: _obscureText,
          autofocus: widget.autofocus,
          enabled: widget.enabled,
          onChanged: _onChanged,
          onFieldSubmitted: widget.onSubmitted,
          validator: widget.validator,
          textInputAction: widget.textInputAction,
          style: theme.textTheme.bodyLarge,
          decoration: InputDecoration(
            hintText: widget.hintText,
            prefixIcon: widget.prefixIcon ?? Icon(
              Icons.lock_outline,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: theme.colorScheme.onSurfaceVariant,
              ),
              onPressed: _toggleVisibility,
              tooltip: _obscureText ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
            ),
            filled: true,
            fillColor: theme.colorScheme.surfaceContainerHighest.withAlpha(77),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 2,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.error,
                width: 1,
              ),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.error,
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
          ),
        ),

        // Password Strength Indicator
        if (widget.showStrengthIndicator && _passwordStrength > 0) ...[
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _passwordStrength / 4,
                    backgroundColor: theme.colorScheme.outline.withAlpha(51),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _getStrengthColor(_passwordStrength),
                    ),
                    minHeight: 4,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                _getStrengthText(_passwordStrength),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: _getStrengthColor(_passwordStrength),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Confirm password field với tính năng toggle visibility
class VnConfirmPasswordField extends StatefulWidget {
  const VnConfirmPasswordField({
    super.key,
    required this.passwordController,
    required this.confirmController,
    this.labelText = 'Xác nhận mật khẩu',
    this.hintText = 'Nhập lại mật khẩu của bạn',
    this.prefixIcon,
    this.onChanged,
    this.autofocus = false,
    this.enabled = true,
    this.onSubmitted,
  });

  /// Controller của password field chính
  final TextEditingController passwordController;

  /// Controller cho confirm field
  final TextEditingController confirmController;

  /// Nhãn hiển thị
  final String labelText;

  /// Gợi ý nhập liệu
  final String hintText;

  /// Icon phía trước
  final Widget? prefixIcon;

  /// Callback khi text thay đổi
  final ValueChanged<String>? onChanged;

  /// Tự động focus
  final bool autofocus;

  /// Có enable không
  final bool enabled;

  /// Callback khi submit
  final ValueChanged<String>? onSubmitted;

  @override
  State<VnConfirmPasswordField> createState() => _VnConfirmPasswordFieldState();
}

class _VnConfirmPasswordFieldState extends State<VnConfirmPasswordField> {
  bool _obscureText = true;

  void _toggleVisibility() {
    setState(() {
      _obscureText = !_obscureText;
    });
  }

  String? _validateConfirmPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng xác nhận mật khẩu';
    }
    if (value != widget.passwordController.text) {
      return 'Mật khẩu không khớp';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Text(
          widget.labelText,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w500,
            color: theme.colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),

        // Confirm Password Field
        TextFormField(
          controller: widget.confirmController,
          obscureText: _obscureText,
          autofocus: widget.autofocus,
          enabled: widget.enabled,
          onChanged: widget.onChanged,
          onFieldSubmitted: widget.onSubmitted,
          validator: _validateConfirmPassword,
          textInputAction: widget.onSubmitted != null
              ? TextInputAction.done
              : TextInputAction.next,
          style: theme.textTheme.bodyLarge,
          decoration: InputDecoration(
            hintText: widget.hintText,
            prefixIcon: widget.prefixIcon ?? Icon(
              Icons.lock_outline,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: theme.colorScheme.onSurfaceVariant,
              ),
              onPressed: _toggleVisibility,
              tooltip: _obscureText ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
            ),
            filled: true,
            fillColor: theme.colorScheme.surfaceContainerHighest.withAlpha(77),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 2,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.error,
                width: 1,
              ),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: theme.colorScheme.error,
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
          ),
        ),
      ],
    );
  }
}
