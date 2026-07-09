import 'package:flutter/material.dart';

/// App color constants following Material 3 design system
/// with Vietnamese e-commerce optimizations
class AppColors {
  AppColors._();

  // ==========================================================================
  // PRIMARY COLORS - Teal 700 (#00796B)
  // ==========================================================================
  static const Color primary = Color(0xFF00796B);
  static const Color primaryLight = Color(0xFF48A999);
  static const Color primaryDark = Color(0xFF004C40);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryContainer = Color(0xFFB2DFDB);
  static const Color onPrimaryContainer = Color(0xFF00251A);

  // ==========================================================================
  // SECONDARY COLORS - Amber 600 (#FFB300)
  // ==========================================================================
  static const Color secondary = Color(0xFFFFB300);
  static const Color secondaryLight = Color(0xFFFFE54C);
  static const Color secondaryDark = Color(0xFFC68400);
  static const Color onSecondary = Color(0xFF000000);
  static const Color secondaryContainer = Color(0xFFFFE082);
  static const Color onSecondaryContainer = Color(0xFF261A00);

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
  static const Color error = Color(0xFFB00020);
  static const Color errorLight = Color(0xFFEF5350);
  static const Color onError = Color(0xFFFFFFFF);
  static const Color errorContainer = Color(0xFFFCD8DF);
  static const Color onErrorContainer = Color(0xFF370617);

  // ==========================================================================
  // SURFACE COLORS - Light Theme
  // ==========================================================================
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF5F5F5);
  static const Color surfaceContainer = Color(0xFFFAFAFA);
  static const Color surfaceContainerLow = Color(0xFFF7F7F7);
  static const Color surfaceContainerHigh = Color(0xFFEEEEEE);
  static const Color onSurface = Color(0xFF1C1B1F);
  static const Color onSurfaceVariant = Color(0xFF49454F);

  // ==========================================================================
  // SURFACE COLORS - Dark Theme
  // ==========================================================================
  static const Color surfaceDark = Color(0xFF1C1B1F);
  static const Color surfaceVariantDark = Color(0xFF49454F);
  static const Color surfaceContainerDark = Color(0xFF2B2930);
  static const Color surfaceContainerLowDark = Color(0xFF252329);
  static const Color surfaceContainerHighDark = Color(0xFF36343B);
  static const Color onSurfaceDark = Color(0xFFE6E1E5);
  static const Color onSurfaceVariantDark = Color(0xFFCAC4D0);

  // ==========================================================================
  // BACKGROUND COLORS
  // ==========================================================================
  static const Color background = Color(0xFFFFFFFF);
  static const Color backgroundDark = Color(0xFF1C1B1F);
  static const Color onBackground = Color(0xFF1C1B1F);
  static const Color onBackgroundDark = Color(0xFFE6E1E5);

  // ==========================================================================
  // OUTLINE & DIVIDER COLORS
  // ==========================================================================
  static const Color outline = Color(0xFF79747E);
  static const Color outlineVariant = Color(0xFFCAC4D0);
  static const Color outlineDark = Color(0xFF938F99);
  static const Color outlineVariantDark = Color(0xFF49454F);

  // ==========================================================================
  // E-COMMERCE SPECIFIC COLORS
  // ==========================================================================

  /// Sale/discount badge - vibrant red for urgency
  static const Color saleBadge = Color(0xFFE53935);
  static const Color saleBadgeDark = Color(0xFFFF6F60);

  /// Success/confirmation - green
  static const Color success = Color(0xFF43A047);
  static const Color successLight = Color(0xFF76D275);
  static const Color onSuccess = Color(0xFFFFFFFF);

  /// Warning/caution
  static const Color warning = Color(0xFFFFA000);
  static const Color warningLight = Color(0xFFFFCA28);
  static const Color onWarning = Color(0xFF000000);

  /// Info/notifications
  static const Color info = Color(0xFF1976D2);
  static const Color infoLight = Color(0xFF64B5F6);
  static const Color onInfo = Color(0xFFFFFFFF);

  /// Price colors -VNĐ currency display
  static const Color priceCurrent = Color(0xFFD32F2F);
  static const Color priceOriginal = Color(0xFF757575);
  static const Color priceDiscount = Color(0xFF388E3C);

  /// Rating stars
  static const Color starFilled = Color(0xFFFFC107);
  static const Color starEmpty = Color(0xFFE0E0E0);

  /// Status indicators
  static const Color inStock = Color(0xFF4CAF50);
  static const Color lowStock = Color(0xFFFF9800);
  static const Color outOfStock = Color(0xFF9E9E9E);

  /// Cart badge
  static const Color cartBadge = Color(0xFFE53935);

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
  static const Color scrim = Color(0x52000000);
  static const Color scrimDark = Color(0xB3000000);

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
