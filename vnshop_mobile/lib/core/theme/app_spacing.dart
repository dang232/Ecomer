import 'package:flutter/material.dart';

/// App spacing constants following 8pt grid system
/// Ensures consistent visual rhythm across the app
class AppSpacing {
  AppSpacing._();

  // ==========================================================================
  // BASE UNIT (4px) - Use sparingly for tight elements
  // ==========================================================================
  static const double unit = 4.0;

  // ==========================================================================
  // SPACING SCALE - Core 8pt grid
  // ==========================================================================

  /// 4px - Micro spacing (icon padding, tight gaps)
  static const double xxs = 4.0;

  /// 8px - Small spacing (inline elements, icon gaps)
  static const double xs = 8.0;

  /// 12px - Medium-small spacing (list item padding)
  static const double sm = 12.0;

  /// 16px - Standard spacing (card padding, section gaps)
  static const double md = 16.0;

  /// 24px - Large spacing (section separators)
  static const double lg = 24.0;

  /// 32px - Extra large spacing (major section gaps)
  static const double xl = 32.0;

  /// 48px - Section spacing (page margins)
  static const double xxl = 48.0;

  /// 64px - Page-level spacing
  static const double xxxl = 64.0;

  // ==========================================================================
  // SCREEN PADDING - Safe area aware
  // ==========================================================================
  static const double screenPadding = 16.0;
  static const double screenPaddingLarge = 24.0;

  // ==========================================================================
  // CARD SPACING
  // ==========================================================================
  static const double cardPadding = 16.0;
  static const double cardPaddingLarge = 20.0;
  static const double cardMargin = 12.0;

  // ==========================================================================
  // LIST SPACING
  // ==========================================================================
  static const double listItemPadding = 12.0;
  static const double listItemSpacing = 8.0;
  static const double listDividerThickness = 1.0;

  // ==========================================================================
  // BUTTON SPACING
  // ==========================================================================
  static const double buttonPadding = 16.0;
  static const double buttonPaddingSmall = 12.0;
  static const double buttonSpacing = 8.0;

  // ==========================================================================
  // INPUT SPACING
  // ==========================================================================
  static const double inputPadding = 16.0;
  static const double inputPaddingSmall = 12.0;
  static const double inputSpacing = 16.0;
  static const double inputLabelSpacing = 8.0;

  // ==========================================================================
  // BORDER RADIUS - Concentric design system
  // ==========================================================================

  /// 4px - Micro (chips, small tags)
  static const double radiusMicro = 4.0;

  /// 8px - Small (buttons, inputs)
  static const double radiusSmall = 8.0;

  /// 12px - Medium (cards, dialogs)
  static const double radiusMedium = 12.0;

  /// 16px - Large (bottom sheets, sheets)
  static const double radiusLarge = 16.0;

  /// 20px - Extra large (modals)
  static const double radiusXL = 20.0;

  /// 24px - Page-level containers
  static const double radiusXXL = 24.0;

  /// 28px - Bottom sheet peek
  static const double radiusBottomSheet = 28.0;

  /// Full circular radius
  static const double radiusFull = 9999.0;

  // ==========================================================================
  // BORDER RADIUS PRESETS (for BorderRadius.circular)
  // ==========================================================================
  static final BorderRadius borderRadiusMicro = BorderRadius.circular(radiusMicro);
  static final BorderRadius borderRadiusSmall = BorderRadius.circular(radiusSmall);
  static final BorderRadius borderRadiusMedium = BorderRadius.circular(radiusMedium);
  static final BorderRadius borderRadiusLarge = BorderRadius.circular(radiusLarge);
  static final BorderRadius borderRadiusXL = BorderRadius.circular(radiusXL);
  static final BorderRadius borderRadiusXXL = BorderRadius.circular(radiusXXL);
  static final BorderRadius borderRadiusBottomSheet = BorderRadius.circular(radiusBottomSheet);
  static final BorderRadius borderRadiusFull = BorderRadius.circular(radiusFull);

  // ==========================================================================
  // SPACING EDGE INSETS
  // ==========================================================================
  static const EdgeInsets paddingXxs = EdgeInsets.all(xxs);
  static const EdgeInsets paddingXs = EdgeInsets.all(xs);
  static const EdgeInsets paddingSm = EdgeInsets.all(sm);
  static const EdgeInsets paddingMd = EdgeInsets.all(md);
  static const EdgeInsets paddingLg = EdgeInsets.all(lg);
  static const EdgeInsets paddingXl = EdgeInsets.all(xl);
  static const EdgeInsets paddingXxl = EdgeInsets.all(xxl);

  // Horizontal padding variants
  static const EdgeInsets paddingHorizontalXs = EdgeInsets.symmetric(horizontal: xs);
  static const EdgeInsets paddingHorizontalSm = EdgeInsets.symmetric(horizontal: sm);
  static const EdgeInsets paddingHorizontalMd = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets paddingHorizontalLg = EdgeInsets.symmetric(horizontal: lg);

  // Vertical padding variants
  static const EdgeInsets paddingVerticalXs = EdgeInsets.symmetric(vertical: xs);
  static const EdgeInsets paddingVerticalSm = EdgeInsets.symmetric(vertical: sm);
  static const EdgeInsets paddingVerticalMd = EdgeInsets.symmetric(vertical: md);
  static const EdgeInsets paddingVerticalLg = EdgeInsets.symmetric(vertical: lg);

  // Screen padding
  static const EdgeInsets screenPaddingAll = EdgeInsets.all(screenPadding);
  static const EdgeInsets screenPaddingHorizontal = EdgeInsets.symmetric(horizontal: screenPadding);
  static const EdgeInsets screenPaddingVertical = EdgeInsets.symmetric(vertical: screenPadding);

  // ==========================================================================
  // GAP WIDGETS - For Row/Column spacing
  // ==========================================================================
  static const SizedBox gapXxs = SizedBox(width: xxs, height: xxs);
  static const SizedBox gapXs = SizedBox(width: xs, height: xs);
  static const SizedBox gapSm = SizedBox(width: sm, height: sm);
  static const SizedBox gapMd = SizedBox(width: md, height: md);
  static const SizedBox gapLg = SizedBox(width: lg, height: lg);
  static const SizedBox gapXl = SizedBox(width: xl, height: xl);
  static const SizedBox gapXxl = SizedBox(width: xxl, height: xxl);

  // Horizontal gaps
  static const SizedBox hGapXxs = SizedBox(width: xxs);
  static const SizedBox hGapXs = SizedBox(width: xs);
  static const SizedBox hGapSm = SizedBox(width: sm);
  static const SizedBox hGapMd = SizedBox(width: md);
  static const SizedBox hGapLg = SizedBox(width: lg);
  static const SizedBox hGapXl = SizedBox(width: xl);
  static const SizedBox hGapXxl = SizedBox(width: xxl);

  // Vertical gaps
  static const SizedBox vGapXxs = SizedBox(height: xxs);
  static const SizedBox vGapXs = SizedBox(height: xs);
  static const SizedBox vGapSm = SizedBox(height: sm);
  static const SizedBox vGapMd = SizedBox(height: md);
  static const SizedBox vGapLg = SizedBox(height: lg);
  static const SizedBox vGapXl = SizedBox(height: xl);
  static const SizedBox vGapXxl = SizedBox(height: xxl);

  // ==========================================================================
  // RESPONSIVE SPACING HELPERS
  // ==========================================================================

  /// Returns responsive spacing based on screen width
  static double responsiveSpacing(BuildContext context, {
    double mobile = md,
    double tablet = lg,
    double desktop = xl,
  }) {
    final width = MediaQuery.of(context).size.width;
    if (width >= 1200) return desktop;
    if (width >= 600) return tablet;
    return mobile;
  }

  /// Returns responsive padding based on screen width
  static EdgeInsets responsivePadding(BuildContext context) {
    final spacing = responsiveSpacing(context);
    return EdgeInsets.all(spacing);
  }
}
