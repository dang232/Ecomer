import 'package:flutter/material.dart';

import '../design_system/generated/design_tokens.dart';

/// App color constants following Material 3 design system
/// with Vietnamese e-commerce optimizations
class AppColors {
  AppColors._();

  // ==========================================================================
  // PRIMARY COLORS
  // ==========================================================================
  static const Color primary = DesignColorsLight.actionPrimary;
  static const Color primaryLight = DesignColorsDark.actionPrimary;
  static const Color primaryDark = DesignColorsLight.actionPrimaryHover;
  static const Color onPrimary = DesignColorsLight.onActionPrimary;
  static const Color primaryContainer = DesignColorsLight.actionPrimarySubtle;
  static const Color onPrimaryContainer = DesignColorsLight.text;

  // ==========================================================================
  // COMMERCE ACCENT COLORS
  // ==========================================================================
  static const Color secondary = DesignColorsLight.commerceAccent;
  static const Color secondaryLight = DesignColorsDark.commerceAccent;
  static const Color secondaryDark = DesignColorsLight.warningText;
  static const Color onSecondary = DesignColorsLight.onCommerceAccent;
  static const Color secondaryContainer = DesignColorsLight.warningSubtle;
  static const Color onSecondaryContainer = DesignColorsLight.warningText;

  // ==========================================================================
  // TERTIARY COLORS - Deep Orange Accent
  // ==========================================================================
  static const Color tertiary = Color(0xFFFF5722);
  static const Color tertiaryLight = Color(0xFFFF8A50);
  static const Color tertiaryDark = Color(0xFFC41C00);
  static const Color onTertiary = Color(0xFFFFFFFF);
  static const Color tertiaryContainer = Color(0xFFFFCCBC);
  static const Color onTertiaryContainer = Color(0xFF390C00);

  // ==========================================================================
  // ERROR COLORS
  // ==========================================================================
  static const Color error = DesignColorsLight.danger;
  static const Color errorLight = DesignColorsDark.danger;
  static const Color onError = DesignColorsLight.onDanger;
  static const Color errorContainer = DesignColorsLight.dangerSubtle;
  static const Color onErrorContainer = DesignColorsLight.dangerText;

  // ==========================================================================
  // SURFACE COLORS - Light Theme
  // ==========================================================================
  static const Color surface = DesignColorsLight.surface;
  static const Color surfaceVariant = DesignColorsLight.surfaceSubtle;
  static const Color surfaceContainer = DesignColorsLight.surface;
  static const Color surfaceContainerLow = DesignColorsLight.canvas;
  static const Color surfaceContainerHigh = DesignColorsLight.surfaceSubtle;
  static const Color onSurface = DesignColorsLight.text;
  static const Color onSurfaceVariant = DesignColorsLight.textMuted;

  // ==========================================================================
  // SURFACE COLORS - Dark Theme
  // ==========================================================================
  static const Color surfaceDark = DesignColorsDark.surface;
  static const Color surfaceVariantDark = DesignColorsDark.surfaceSubtle;
  static const Color surfaceContainerDark = DesignColorsDark.surface;
  static const Color surfaceContainerLowDark = DesignColorsDark.canvas;
  static const Color surfaceContainerHighDark = DesignColorsDark.surfaceRaised;
  static const Color onSurfaceDark = DesignColorsDark.text;
  static const Color onSurfaceVariantDark = DesignColorsDark.textMuted;

  // ==========================================================================
  // BACKGROUND COLORS
  // ==========================================================================
  static const Color background = DesignColorsLight.canvas;
  static const Color backgroundDark = DesignColorsDark.canvas;
  static const Color onBackground = DesignColorsLight.text;
  static const Color onBackgroundDark = DesignColorsDark.text;

  // ==========================================================================
  // OUTLINE & DIVIDER COLORS
  // ==========================================================================
  static const Color outline = DesignColorsLight.borderStrong;
  static const Color outlineVariant = DesignColorsLight.border;
  static const Color outlineDark = DesignColorsDark.borderStrong;
  static const Color outlineVariantDark = DesignColorsDark.border;

  // ==========================================================================
  // E-COMMERCE SPECIFIC COLORS
  // ==========================================================================

  /// Sale/discount badge - vibrant red for urgency
  static const Color saleBadge = DesignColorsLight.danger;
  static const Color saleBadgeDark = DesignColorsDark.danger;

  /// Success/confirmation - green
  static const Color success = DesignColorsLight.success;
  static const Color successLight = DesignColorsDark.success;
  static const Color onSuccess = DesignColorsLight.onSuccess;

  /// Warning/caution
  static const Color warning = DesignColorsLight.commerceAccent;
  static const Color warningLight = DesignColorsDark.commerceAccent;
  static const Color onWarning = DesignColorsLight.onCommerceAccent;

  /// Info/notifications
  static const Color info = DesignColorsLight.info;
  static const Color infoLight = DesignColorsDark.info;
  static const Color onInfo = DesignColorsLight.onInfo;

  /// Price colors -VNĐ currency display
  static const Color priceCurrent = DesignColorsLight.danger;
  static const Color priceOriginal = DesignColorsLight.textMuted;
  static const Color priceDiscount = DesignColorsLight.success;

  /// Rating stars
  static const Color starFilled = Color(0xFFFFC107);
  static const Color starEmpty = Color(0xFFE0E0E0);

  /// Status indicators
  static const Color inStock = DesignColorsLight.success;
  static const Color lowStock = DesignColorsLight.commerceAccent;
  static const Color outOfStock = DesignColorsLight.textMuted;

  /// Cart badge
  static const Color cartBadge = DesignColorsLight.danger;

  // ==========================================================================
  // PAYMENT BRAND COLORS
  // ==========================================================================
  static const Color vnpayBlue = Color(0xFF0066B3);
  static const Color momoPink = Color(0xFFA50064);
  static const Color vietqrBlue = Color(0xFF1A73E8);
  static const Color codOrange = Color(0xFFFF6D00);
  static const Color bankGreen = Color(0xFF2E7D32);

  // ==========================================================================
  // SHADOW & OVERLAY COLORS
  // ==========================================================================
  static const Color shadow = Color(0x1A000000);
  static const Color shadowDark = Color(0x4D000000);
  static const Color scrim = DesignColorsLight.overlay;
  static const Color scrimDark = DesignColorsDark.overlay;

  // ==========================================================================
  // GRADIENT PRESETS
  // ==========================================================================
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient secondaryGradient = LinearGradient(
    colors: [secondary, secondaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient saleGradient = LinearGradient(
    colors: [Color(0xFFE53935), Color(0xFFFF7043)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient darkOverlayGradient = LinearGradient(
    colors: [Colors.transparent, Color(0x80000000)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}
