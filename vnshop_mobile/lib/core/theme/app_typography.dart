import 'package:flutter/material.dart';

import 'app_colors.dart';

/// App typography constants following Material 3 type scale
/// with Vietnamese font support and e-commerce optimizations
class AppTypography {
  AppTypography._();

  // ==========================================================================
  // FONT FAMILY - Vietnamese optimized
  // ==========================================================================
  
  /// Primary font family - uses system fonts for best Vietnamese rendering
  /// Fallback chain: SF Pro (iOS) -> Roboto (Android) -> System
  static const String fontFamily = '.SF Pro Text';
  static const String fontFamilyMedium = '.SF Pro Text';
  static const String fontFamilyBold = '.SF Pro Display';
  
  /// Alternative fonts for specific use cases
  static const String fontFamilyVietnamese = 'Roboto';
  static const String fontFamilyMonospace = 'Menlo';

  // ==========================================================================
  // FONT WEIGHTS
  // ==========================================================================
  static const FontWeight regular = FontWeight.w400;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight semiBold = FontWeight.w600;
  static const FontWeight bold = FontWeight.w700;

  // ==========================================================================
  // DISPLAY STYLES - Large headlines
  // ==========================================================================
  
  static TextStyle displayLarge = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 57,
    fontWeight: bold,
    letterSpacing: -0.25,
    height: 1.12,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.onSurface,
  );

  static TextStyle displayMedium = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 45,
    fontWeight: bold,
    letterSpacing: 0,
    height: 1.16,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.onSurface,
  );

  static TextStyle displaySmall = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 36,
    fontWeight: bold,
    letterSpacing: 0,
    height: 1.22,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.onSurface,
  );

  // ==========================================================================
  // HEADLINE STYLES - Section headers
  // ==========================================================================
  
  static TextStyle headlineLarge = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 32,
    fontWeight: bold,
    letterSpacing: 0,
    height: 1.25,
    color: AppColors.onSurface,
  );

  static TextStyle headlineMedium = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 28,
    fontWeight: semiBold,
    letterSpacing: 0,
    height: 1.29,
    color: AppColors.onSurface,
  );

  static TextStyle headlineSmall = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 24,
    fontWeight: semiBold,
    letterSpacing: 0,
    height: 1.33,
    color: AppColors.onSurface,
  );

  // ==========================================================================
  // TITLE STYLES - Card titles, list headers
  // ==========================================================================
  
  static TextStyle titleLarge = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 22,
    fontWeight: semiBold,
    letterSpacing: 0,
    height: 1.27,
    color: AppColors.onSurface,
  );

  static TextStyle titleMedium = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 16,
    fontWeight: semiBold,
    letterSpacing: 0.15,
    height: 1.5,
    color: AppColors.onSurface,
  );

  static TextStyle titleSmall = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 14,
    fontWeight: semiBold,
    letterSpacing: 0.1,
    height: 1.43,
    color: AppColors.onSurface,
  );

  // ==========================================================================
  // BODY STYLES - Main content
  // ==========================================================================
  
  static TextStyle bodyLarge = const TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    fontWeight: regular,
    letterSpacing: 0.5,
    height: 1.5,
    color: AppColors.onSurface,
  );

  static TextStyle bodyMedium = const TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: regular,
    letterSpacing: 0.25,
    height: 1.43,
    color: AppColors.onSurface,
  );

  static TextStyle bodySmall = const TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    fontWeight: regular,
    letterSpacing: 0.4,
    height: 1.33,
    color: AppColors.onSurfaceVariant,
  );

  // ==========================================================================
  // LABEL STYLES - Buttons, chips, form labels
  // ==========================================================================
  
  static TextStyle labelLarge = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 14,
    fontWeight: medium,
    letterSpacing: 0.1,
    height: 1.43,
    color: AppColors.onSurface,
  );

  static TextStyle labelMedium = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 12,
    fontWeight: medium,
    letterSpacing: 0.5,
    height: 1.33,
    color: AppColors.onSurface,
  );

  static TextStyle labelSmall = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    fontWeight: medium,
    letterSpacing: 0.5,
    height: 1.45,
    color: AppColors.onSurfaceVariant,
  );

  // ==========================================================================
  // E-COMMERCE SPECIFIC STYLES
  // ==========================================================================

  /// Price display - VNĐ currency with tabular figures for alignment
  static TextStyle priceLarge = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 24,
    fontWeight: bold,
    letterSpacing: -0.5,
    height: 1.2,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.priceCurrent,
  );

  /// Price in product cards
  static TextStyle priceMedium = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 18,
    fontWeight: bold,
    letterSpacing: -0.25,
    height: 1.22,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.priceCurrent,
  );

  /// Small price (discount badges, mini cards)
  static TextStyle priceSmall = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 14,
    fontWeight: bold,
    letterSpacing: 0,
    height: 1.29,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.priceCurrent,
  );

  /// Original price (crossed out)
  static TextStyle priceOriginal = const TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    fontWeight: regular,
    letterSpacing: 0,
    height: 1.33,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.priceOriginal,
    decoration: TextDecoration.lineThrough,
    decorationColor: AppColors.priceOriginal,
  );

  /// Discount percentage badge
  static TextStyle discountBadge = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 10,
    fontWeight: bold,
    letterSpacing: 0,
    height: 1.2,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.onPrimary,
  );

  /// Product name in list
  static TextStyle productName = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 14,
    fontWeight: medium,
    letterSpacing: 0,
    height: 1.4,
    color: AppColors.onSurface,
  );

  /// Product name in detail view
  static TextStyle productNameLarge = const TextStyle(
    fontFamily: fontFamilyBold,
    fontSize: 20,
    fontWeight: bold,
    letterSpacing: 0,
    height: 1.3,
    color: AppColors.onSurface,
  );

  /// Short description text
  static TextStyle productDescription = const TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: regular,
    letterSpacing: 0.15,
    height: 1.46,
    color: AppColors.onSurfaceVariant,
  );

  /// Rating display
  static TextStyle rating = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 12,
    fontWeight: medium,
    letterSpacing: 0,
    height: 1.33,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.onSurfaceVariant,
  );

  /// Stock status text
  static TextStyle stockStatus = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    fontWeight: medium,
    letterSpacing: 0.5,
    height: 1.45,
  );

  /// Cart item quantity
  static TextStyle quantity = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 14,
    fontWeight: medium,
    letterSpacing: 0,
    height: 1.43,
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.onSurface,
  );

  /// Order status
  static TextStyle orderStatus = const TextStyle(
    fontFamily: fontFamilyMedium,
    fontSize: 12,
    fontWeight: medium,
    letterSpacing: 0.5,
    height: 1.33,
  );

  /// Notification text
  static TextStyle notification = const TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: regular,
    letterSpacing: 0.25,
    height: 1.43,
    color: AppColors.onSurface,
  );

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /// Creates a copy of a text style with custom properties
  static TextStyle copy(
    TextStyle style, {
    Color? color,
    FontWeight? fontWeight,
    double? fontSize,
    String? fontFamily,
    List<FontFeature>? fontFeatures,
  }) {
    return style.copyWith(
      color: color,
      fontWeight: fontWeight,
      fontSize: fontSize,
      fontFamily: fontFamily,
      fontFeatures: fontFeatures,
    );
  }

  /// Returns a muted version of a style for secondary text
  static TextStyle muted(TextStyle style) {
    return style.copyWith(color: AppColors.onSurfaceVariant);
  }
}

/// Vietnamese font configuration for optimal rendering
class VietnameseFontConfig {
  VietnameseFontConfig._();

  /// Font fallback chain for Vietnamese characters
  static const List<String> vietnameseFontFallback = [
    '.SF Pro Text',
    'SF Pro Text',
    'Roboto',
    'Noto Sans',
    'Segoe UI',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ];

  /// Apply Vietnamese font settings to TextTheme
  static TextTheme applyVietnameseFonts(TextTheme theme) {
    return theme.copyWith(
      displayLarge: theme.displayLarge?.copyWith(
        fontFamily: '.SF Pro Display',
      ),
      displayMedium: theme.displayMedium?.copyWith(
        fontFamily: '.SF Pro Display',
      ),
      displaySmall: theme.displaySmall?.copyWith(
        fontFamily: '.SF Pro Display',
      ),
      headlineLarge: theme.headlineLarge?.copyWith(
        fontFamily: '.SF Pro Display',
      ),
      headlineMedium: theme.headlineMedium?.copyWith(
        fontFamily: '.SF Pro Display',
      ),
      headlineSmall: theme.headlineSmall?.copyWith(
        fontFamily: '.SF Pro Display',
      ),
      titleLarge: theme.titleLarge?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      titleMedium: theme.titleMedium?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      titleSmall: theme.titleSmall?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      bodyLarge: theme.bodyLarge?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      bodyMedium: theme.bodyMedium?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      bodySmall: theme.bodySmall?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      labelLarge: theme.labelLarge?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      labelMedium: theme.labelMedium?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
      labelSmall: theme.labelSmall?.copyWith(
        fontFamily: '.SF Pro Text',
      ),
    );
  }
}
