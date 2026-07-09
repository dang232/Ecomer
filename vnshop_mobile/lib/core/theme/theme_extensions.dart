import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_spacing.dart';

/// ThemeData extensions for VNShop app
/// Provides convenient accessors for custom theme properties
extension ThemeExtensions on ThemeData {
  // ==========================================================================
  // CUSTOM COLOR ACCESSORS
  // ==========================================================================

  /// Primary color from color scheme
  Color get primaryColor => colorScheme.primary;

  /// Secondary color from color scheme
  Color get secondaryColor => colorScheme.secondary;

  /// Surface color from color scheme
  Color get surfaceColor => colorScheme.surface;

  /// Background color (scaffold)
  Color get backgroundColor => scaffoldBackgroundColor;

  /// Success color for confirmations
  Color get successColor => AppColors.success;

  /// Warning color for alerts
  Color get warningColor => AppColors.warning;

  /// Info color for notifications
  Color get infoColor => AppColors.info;

  /// Sale badge color
  Color get saleBadgeColor => AppColors.saleBadge;

  /// Price current color
  Color get priceColor => AppColors.priceCurrent;

  /// Price original (crossed out) color
  Color get priceOriginalColor => AppColors.priceOriginal;

  /// Star rating color
  Color get starColor => AppColors.starFilled;

  /// Cart badge color
  Color get cartBadgeColor => AppColors.cartBadge;

  /// In stock indicator
  Color get inStockColor => AppColors.inStock;

  /// Low stock indicator
  Color get lowStockColor => AppColors.lowStock;

  /// Out of stock indicator
  Color get outOfStockColor => AppColors.outOfStock;

  // ==========================================================================
  // SPACING ACCESSORS
  // ==========================================================================

  /// Standard spacing unit (16px)
  double get spacing => AppSpacing.md;

  /// Small spacing (8px)
  double get spacingSmall => AppSpacing.xs;

  /// Large spacing (24px)
  double get spacingLarge => AppSpacing.lg;

  /// Extra large spacing (32px)
  double get spacingLarge2 => AppSpacing.xl;

  /// Screen padding
  EdgeInsets get screenPadding => AppSpacing.screenPaddingAll;

  /// Card padding
  EdgeInsets get cardPadding => const EdgeInsets.all(AppSpacing.cardPadding);

  // ==========================================================================
  // BORDER RADIUS ACCESSORS
  // ==========================================================================

  /// Small border radius (8px)
  BorderRadius get radiusSmall => AppSpacing.borderRadiusSmall;

  /// Medium border radius (12px)
  BorderRadius get radiusMedium => AppSpacing.borderRadiusMedium;

  /// Large border radius (16px)
  BorderRadius get radiusLarge => AppSpacing.borderRadiusLarge;

  /// Extra large border radius (20px)
  BorderRadius get radiusXL => AppSpacing.borderRadiusXL;

  /// Bottom sheet border radius (28px)
  BorderRadius get radiusBottomSheet => AppSpacing.borderRadiusBottomSheet;

  /// Full circular radius
  BorderRadius get radiusFull => AppSpacing.borderRadiusFull;

  // ==========================================================================
  // E-COMMERCE HELPER ACCESSORS
  // ==========================================================================

  /// Primary gradient for headers and highlights
  Gradient get primaryGradient => AppColors.primaryGradient;

  /// Secondary gradient for CTAs
  Gradient get secondaryGradient => AppColors.secondaryGradient;

  /// Sale gradient for discount badges
  Gradient get saleGradient => AppColors.saleGradient;

  /// Dark overlay gradient for image overlays
  Gradient get darkOverlayGradient => AppColors.darkOverlayGradient;

  // ==========================================================================
  // SHADOW PREFERENCES
  // ==========================================================================

  /// Card shadow (medium elevation)
  List<BoxShadow> get cardShadow => AppShadows.cardMedium;

  /// Product card shadow
  List<BoxShadow> get productCardShadow => AppShadows.productCard;

  /// Bottom sheet shadow
  List<BoxShadow> get bottomSheetShadow => AppShadows.bottomSheet;

  /// Dialog shadow
  List<BoxShadow> get dialogShadow => AppShadows.dialog;

  /// FAB shadow
  List<BoxShadow> get fabShadow => AppShadows.fab;

  /// App bar shadow
  List<BoxShadow> get appBarShadow => AppShadows.appBar;
}

/// BuildContext extensions for quick theme access
extension ContextExtensions on BuildContext {
  // ==========================================================================
  // THEME ACCESSORS
  // ==========================================================================

  /// Current theme data
  ThemeData get theme => Theme.of(this);

  /// Text theme
  TextTheme get textTheme => theme.textTheme;

  /// Color scheme
  ColorScheme get colorScheme => theme.colorScheme;

  /// Is dark mode
  bool get isDarkMode => theme.brightness == Brightness.dark;

  /// Is light mode
  bool get isLightMode => theme.brightness == Brightness.light;

  // ==========================================================================
  // CUSTOM THEME ACCESSORS
  // ==========================================================================

  /// Primary color
  Color get primaryColor => theme.colorScheme.primary;

  /// Secondary color
  Color get secondaryColor => theme.colorScheme.secondary;

  /// Surface color
  Color get surfaceColor => theme.colorScheme.surface;

  /// Background color
  Color get backgroundColor => theme.scaffoldBackgroundColor;

  /// On surface color
  Color get onSurfaceColor => theme.colorScheme.onSurface;

  /// On surface variant color
  Color get onSurfaceVariantColor => theme.colorScheme.onSurfaceVariant;

  /// Success color
  Color get successColor => AppColors.success;

  /// Warning color
  Color get warningColor => AppColors.warning;

  /// Error color
  Color get errorColor => theme.colorScheme.error;

  /// Sale badge color
  Color get saleBadgeColor => AppColors.saleBadge;

  /// Price color
  Color get priceColor => AppColors.priceCurrent;

  /// Price original color
  Color get priceOriginalColor => AppColors.priceOriginal;

  /// Star color
  Color get starColor => AppColors.starFilled;

  // ==========================================================================
  // SCREEN & MEDIA
  // ==========================================================================

  /// Media query data
  MediaQueryData get mediaQuery => MediaQuery.of(this);

  /// Screen size
  Size get screenSize => mediaQuery.size;

  /// Screen width
  double get screenWidth => screenSize.width;

  /// Screen height
  double get screenHeight => screenSize.height;

  /// Orientation
  Orientation get orientation => mediaQuery.orientation;

  /// Is landscape
  bool get isLandscape => orientation == Orientation.landscape;

  /// Is portrait
  bool get isPortrait => orientation == Orientation.portrait;

  /// Is tablet (width >= 600)
  bool get isTablet => screenWidth >= 600;

  /// Is desktop (width >= 1200)
  bool get isDesktop => screenWidth >= 1200;

  /// Is phone (width < 600)
  bool get isPhone => screenWidth < 600;

  /// Safe area padding
  EdgeInsets get safeArea => mediaQuery.padding;

  /// Bottom safe area (for gesture bar)
  double get bottomSafe => safeArea.bottom;

  /// Top safe area (for notch/status bar)
  double get topSafe => safeArea.top;

  /// View insets (keyboard)
  EdgeInsets get viewInsets => mediaQuery.viewInsets;

  /// Is keyboard visible
  bool get isKeyboardVisible => viewInsets.bottom > 0;

  // ==========================================================================
  // SPACING HELPERS
  // ==========================================================================

  /// Responsive spacing
  double responsiveSpacing({
    double mobile = AppSpacing.md,
    double tablet = AppSpacing.lg,
    double desktop = AppSpacing.xl,
  }) {
    if (isDesktop) return desktop;
    if (isTablet) return tablet;
    return mobile;
  }

  /// Responsive padding
  EdgeInsets responsivePadding({
    double mobile = AppSpacing.md,
    double tablet = AppSpacing.lg,
    double desktop = AppSpacing.xl,
  }) {
    final spacing = responsiveSpacing(
      mobile: mobile,
      tablet: tablet,
      desktop: desktop,
    );
    return EdgeInsets.all(spacing);
  }

  // ==========================================================================
  // LOCALIZATION HELPERS
  // ==========================================================================

  /// Get localized text direction
  TextDirection get textDirection => Directionality.of(this);

  /// Is RTL
  bool get isRTL => textDirection == TextDirection.rtl;

  /// Is LTR
  bool get isLTR => textDirection == TextDirection.ltr;
}

/// TextStyle extensions for typography helpers
extension TextStyleExtensions on TextStyle {
  /// Create a bold version
  TextStyle get bold => copyWith(fontWeight: FontWeight.bold);

  /// Create a semi-bold version
  TextStyle get semiBold => copyWith(fontWeight: FontWeight.w600);

  /// Create a medium version
  TextStyle get medium => copyWith(fontWeight: FontWeight.w500);

  /// Create a regular version
  TextStyle get regular => copyWith(fontWeight: FontWeight.w400);

  /// Set primary color
  TextStyle get primary => copyWith(color: AppColors.primary);

  /// Set secondary color
  TextStyle get secondary => copyWith(color: AppColors.secondary);

  /// Set error color
  TextStyle get error => copyWith(color: AppColors.error);

  /// Set muted color
  TextStyle get muted => copyWith(color: AppColors.onSurfaceVariant);

  /// Set price color
  TextStyle get price => copyWith(color: AppColors.priceCurrent);

  /// Set strikethrough
  TextStyle get strikethrough => copyWith(
    decoration: TextDecoration.lineThrough,
    decorationColor: color,
  );

  /// Set underline
  TextStyle get underline => copyWith(
    decoration: TextDecoration.underline,
    decorationColor: color,
  );

  /// Add tabular figures
  TextStyle get tabular => copyWith(
    fontFeatures: const [FontFeature.tabularFigures()],
  );

  /// Set font size
  TextStyle fontSize(double size) => copyWith(fontSize: size);

  /// Set letter spacing
  TextStyle letterSpacing(double spacing) => copyWith(letterSpacing: spacing);

  /// Set line height
  TextStyle lineHeight(double height) => copyWith(height: height);
}

/// Color extensions
extension ColorExtensions on Color {
  /// Lighten color
  Color lighten([double amount = 0.1]) {
    assert(amount >= 0 && amount <= 1);
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness + amount).clamp(0.0, 1.0)).toColor();
  }

  /// Darken color
  Color darken([double amount = 0.1]) {
    assert(amount >= 0 && amount <= 1);
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness - amount).clamp(0.0, 1.0)).toColor();
  }

  /// Get contrasting text color
  Color get contrastingTextColor {
    final luminance = computeLuminance();
    return luminance > 0.5 ? Colors.black : Colors.white;
  }
}

/// AppShadows reference for extensions
class AppShadows {
  static List<BoxShadow> get cardMedium => [
    const BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> get productCard => [
    const BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 2),
      blurRadius: 6,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> get bottomSheet => [
    const BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, -4),
      blurRadius: 16,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> get dialog => [
    const BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 12),
      blurRadius: 24,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> get fab => [
    const BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 4),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  static List<BoxShadow> get appBar => [
    const BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 2),
      blurRadius: 4,
      spreadRadius: 0,
    ),
  ];
}
