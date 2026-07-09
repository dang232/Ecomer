import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

/// Text input field với nhãn tiếng Việt, validation states, icons
/// Tuân thủ nguyên tắc make-interfaces-feel-better
class VnTextField extends StatelessWidget {
  const VnTextField({
    super.key,
    required this.controller,
    required this.labelText,
    this.hintText,
    this.prefixIcon,
    this.suffixIcon,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.autocorrect = false,
    this.enabled = true,
    this.maxLength,
    this.autofocus = false,
    this.textCapitalization = TextCapitalization.none,
    this.errorText,
    this.helperText,
    this.isRequired = false,
    this.onTap,
    this.readOnly = false,
    this.maxLines = 1,
    this.minLines,
    this.initialValue,
    this.focusNode,
    this.onEditingComplete,
  });

  /// Controller cho text field
  final TextEditingController? controller;

  /// Nhãn hiển thị (mặc định tiếng Việt)
  final String labelText;

  /// Gợi ý nhập liệu
  final String? hintText;

  /// Icon phía trước
  final Widget? prefixIcon;

  /// Icon phía sau
  final Widget? suffixIcon;

  /// Callback khi text thay đổi
  final ValueChanged<String>? onChanged;

  /// Callback khi submit
  final ValueChanged<String>? onSubmitted;

  /// Validator function
  final String? Function(String?)? validator;

  /// Loại bàn phím
  final TextInputType keyboardType;

  /// Action trên bàn phím
  final TextInputAction textInputAction;

  /// Tự động sửa lỗi chính tả
  final bool autocorrect;

  /// Có enable không
  final bool enabled;

  /// Giới hạn độ dài
  final int? maxLength;

  /// Tự động focus
  final bool autofocus;

  /// Viết hoa
  final TextCapitalization textCapitalization;

  /// Text lỗi hiển thị
  final String? errorText;

  /// Text hướng dẫn
  final String? helperText;

  /// Bắt buộc nhập (hiển thị dấu *)
  final bool isRequired;

  /// Callback khi tap vào field
  final VoidCallback? onTap;

  /// Chỉ đọc
  final bool readOnly;

  /// Số dòng tối đa
  final int maxLines;

  /// Số dòng tối thiểu
  final int? minLines;

  /// Giá trị ban đầu (thay thế controller nếu provided)
  final String? initialValue;

  /// Focus node
  final FocusNode? focusNode;

  /// Callback khi hoàn thành edit
  final VoidCallback? onEditingComplete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label
        Row(
          children: [
            Text(
              labelText,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                color: theme.colorScheme.onSurface,
              ),
            ),
            if (isRequired)
              Text(
                ' *',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: theme.colorScheme.error,
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),

        // Text Field
        TextFormField(
          controller: controller,
          initialValue: initialValue,
          focusNode: focusNode,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autocorrect: autocorrect,
          enabled: enabled,
          maxLength: maxLength,
          autofocus: autofocus,
          textCapitalization: textCapitalization,
          onChanged: onChanged,
          onFieldSubmitted: onSubmitted,
          onTap: onTap,
          onEditingComplete: onEditingComplete,
          readOnly: readOnly,
          maxLines: maxLines,
          minLines: minLines,
          validator: validator,
          style: theme.textTheme.bodyLarge,
          decoration: InputDecoration(
            hintText: hintText,
            prefixIcon: prefixIcon,
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: theme.colorScheme.surfaceContainerHighest.withAlpha(77),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide(
                color: theme.colorScheme.primary,
                width: 2,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide(
                color: theme.colorScheme.error,
                width: 1,
              ),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide(
                color: theme.colorScheme.error,
                width: 2,
              ),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide(
                color: theme.colorScheme.outline.withAlpha(77),
                width: 1,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            counterText: '',
            errorText: errorText,
            helperText: helperText,
            helperMaxLines: 2,
            errorMaxLines: 2,
          ),
        ),
      ],
    );
  }
}

/// Widget hiển thị trạng thái validation
class VnTextFieldValidation extends StatelessWidget {
  const VnTextFieldValidation({
    super.key,
    required this.child,
    required this.errorText,
    this.hasError = false,
    this.successText,
  });

  final Widget child;
  final String errorText;
  final bool hasError;
  final String? successText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        child,
        if (hasError && errorText.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 12),
            child: Text(
              errorText,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          )
        else if (successText != null && successText!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 12),
            child: Text(
              successText!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.success,
              ),
            ),
          ),
      ],
    );
  }
}
