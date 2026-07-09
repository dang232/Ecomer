import 'package:flutter/material.dart';

import 'app_colors.dart';

/// App shadow presets following Material 3 elevation system
/// with concentric design principles for visual depth hierarchy
class AppShadows {
  AppShadows._();

  // ==========================================================================
  // SHADOW COLOR CONFIGURATION
  // ==========================================================================
  
  /// Light theme shadow color - subtle, warm
  static const Color _shadowColorLight = Color(0x1A000000);
  
  /// Dark theme shadow color - more opaque for contrast
  static const Color _shadowColorDark = Color(0x4D000000);

  // ==========================================================================
  // ELEVATION LEVEL SHADOWS - Material 3 style
  // ==========================================================================

  /// Level 0 - No shadow (flat surfaces)
  static List<BoxShadow> get elevation0 => [];

  /// Level 1 - Cards at rest, chips
  static List<BoxShadow> elevation1 = [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 1),
      blurRadius: 2,
      spreadRadius: 0,
    ),
  ];

  /// Level 2 - Elevated cards, FABs at rest
  static List<BoxShadow> elevation2 = [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  /// Level 3 - Floating action buttons, bottom navigation
  static List<BoxShadow> elevation3 = [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  /// Level 4 - Dialogs, bottom sheets
  static List<BoxShadow> elevation4 = [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 6),
      blurRadius: 12,
      spreadRadius: 0,
    ),
  ];

  /// Level 5 - Modal dialogs, drawers
  static List<BoxShadow> elevation5 = [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 8),
      blurRadius: 16,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // CUSTOM SHADOW PRESETS - E-commerce specific
  // ==========================================================================

  /// Product card shadow - subtle lift on hover/tap
  static List<BoxShadow> get productCard => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  /// Product card hover/pressed state
  static List<BoxShadow> get productCardHover => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 4),
      blurRadius: 10,
      spreadRadius: 0,
    ),
  ];

  /// Bottom sheet shadow - top heavy for pull indicator emphasis
  static List<BoxShadow> get bottomSheet => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, -4),
      blurRadius: 16,
      spreadRadius: 0,
    ),
  ];

  /// Dialog shadow - maximum depth for modal emphasis
  static List<BoxShadow> get dialog => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 12),
      blurRadius: 24,
      spreadRadius: 0,
    ),
  ];

  /// App bar shadow - minimal, integrates with surface
  static List<BoxShadow> get appBar => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  /// FAB shadow - prominent for action emphasis
  static List<BoxShadow> get fab => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  /// Cart badge shadow - small but visible
  static List<BoxShadow> get cartBadge => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 1),
      blurRadius: 3,
      spreadRadius: 0,
    ),
  ];

  /// Sale badge shadow - subtle emphasis
  static List<BoxShadow> get saleBadge => [
    BoxShadow(
      color: const Color(0x33000000),
      offset: const Offset(0, 1),
      blurRadius: 2,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // CARD SHADOWS - Concentric design
  // ==========================================================================

  /// Small card - minimal elevation
  static List<BoxShadow> get cardSmall => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 1),
      blurRadius: 3,
      spreadRadius: 0,
    ),
  ];

  /// Medium card - standard elevation
  static List<BoxShadow> get cardMedium => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  /// Large card - featured/hero content
  static List<BoxShadow> get cardLarge => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 4),
      blurRadius: 10,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // INPUT SHADOWS - Form elements
  // ==========================================================================

  /// Input field default state
  static List<BoxShadow> get inputDefault => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 1),
      blurRadius: 2,
      spreadRadius: 0,
    ),
  ];

  /// Input field focused state - subtle glow
  static List<BoxShadow> get inputFocused => [
    BoxShadow(
      color: AppColors.primary.withValues(alpha: 0.2),
      offset: const Offset(0, 0),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  /// Input field error state
  static List<BoxShadow> get inputError => [
    BoxShadow(
      color: AppColors.error.withValues(alpha: 0.2),
      offset: const Offset(0, 0),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // DROPDOWN & MENU SHADOWS
  // ==========================================================================

  /// Dropdown menu shadow
  static List<BoxShadow> get dropdown => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  /// Context menu shadow
  static List<BoxShadow> get contextMenu => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 8),
      blurRadius: 16,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // LOADING & SKELETON SHADOWS
  // ==========================================================================

  /// Skeleton loading shimmer base
  static List<BoxShadow> get skeleton => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 1),
      blurRadius: 2,
      spreadRadius: 0,
    ),
  ];

  /// Pull to refresh indicator
  static List<BoxShadow> get pullRefresh => [
    BoxShadow(
      color: _shadowColorLight,
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // DARK THEME SHADOWS
  // ==========================================================================

  /// Dark theme card shadow
  static List<BoxShadow> get cardDark => [
    BoxShadow(
      color: _shadowColorDark,
      offset: const Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  /// Dark theme dialog shadow
  static List<BoxShadow> get dialogDark => [
    BoxShadow(
      color: _shadowColorDark,
      offset: const Offset(0, 12),
      blurRadius: 24,
      spreadRadius: 0,
    ),
  ];

  /// Dark theme FAB shadow
  static List<BoxShadow> get fabDark => [
    BoxShadow(
      color: const Color(0x40000000),
      offset: const Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  // ==========================================================================
  // BOX DECORATION FACTORY
  // ==========================================================================

  /// Creates a BoxDecoration with shadow preset
  static BoxDecoration boxDecoration({
    required List<BoxShadow> shadows,
    Color? color,
    BorderRadius? borderRadius,
    Border? border,
  }) {
    return BoxDecoration(
      color: color,
      borderRadius: borderRadius,
      border: border,
      boxShadow: shadows,
    );
  }

  /// Creates a card decoration with preset shadow
  static BoxDecoration cardDecoration({
    bool large = false,
    Color? color,
    BorderRadius? borderRadius,
  }) {
    return BoxDecoration(
      color: color,
      borderRadius: borderRadius ?? BorderRadius.circular(12),
      boxShadow: large ? cardLarge : cardMedium,
    );
  }

  /// Creates a product card decoration
  static BoxDecoration productCardDecoration({
    bool pressed = false,
    Color? color,
    BorderRadius? borderRadius,
  }) {
    return BoxDecoration(
      color: color,
      borderRadius: borderRadius ?? BorderRadius.circular(12),
      boxShadow: pressed ? productCardHover : productCard,
    );
  }
}

/// Common shadow presets as extension methods for easier access
extension ShadowPresets on BuildContext {
  List<BoxShadow> get cardShadow => AppShadows.cardMedium;
  List<BoxShadow> get productCardShadow => AppShadows.productCard;
  List<BoxShadow> get bottomSheetShadow => AppShadows.bottomSheet;
  List<BoxShadow> get dialogShadow => AppShadows.dialog;
  List<BoxShadow> get fabShadow => AppShadows.fab;
  List<BoxShadow> get appBarShadow => AppShadows.appBar;
}
