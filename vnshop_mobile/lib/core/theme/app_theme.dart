import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design_system/generated/design_tokens.dart';
import 'app_colors.dart';
import 'app_spacing.dart';

/// VNShop App Theme - Material 3 Design System
/// Optimized for Vietnamese e-commerce with concentric design principles
class AppTheme {
  AppTheme._();

  // ==========================================================================
  // THEME CONFIGURATION
  // ==========================================================================

  /// Light theme configuration
  static ThemeData lightTheme = _buildLightTheme();

  /// Dark theme configuration
  static ThemeData darkTheme = _buildDarkTheme();

  // ==========================================================================
  // LIGHT THEME BUILDER
  // ==========================================================================

  static ThemeData _buildLightTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,

      // --------------------------------------------------------------------
      // COLOR SCHEME
      // --------------------------------------------------------------------
      colorScheme: const ColorScheme.light(
        primary: DesignColorsLight.actionPrimary,
        onPrimary: DesignColorsLight.onActionPrimary,
        primaryContainer: DesignColorsLight.actionPrimarySubtle,
        onPrimaryContainer: DesignColorsLight.text,

        secondary: AppColors.secondary,
        onSecondary: AppColors.onSecondary,
        secondaryContainer: AppColors.secondaryContainer,
        onSecondaryContainer: AppColors.onSecondaryContainer,

        tertiary: AppColors.tertiary,
        onTertiary: AppColors.onTertiary,
        tertiaryContainer: AppColors.tertiaryContainer,
        onTertiaryContainer: AppColors.onTertiaryContainer,

        error: AppColors.error,
        onError: AppColors.onError,
        errorContainer: AppColors.errorContainer,
        onErrorContainer: AppColors.onErrorContainer,

        surface: AppColors.surface,
        onSurface: AppColors.onSurface,
        surfaceContainerHighest: AppColors.surfaceContainerHigh,

        outline: AppColors.outline,
        outlineVariant: AppColors.outlineVariant,
      ),

      // --------------------------------------------------------------------
      // SCAFFOLD
      // --------------------------------------------------------------------
      scaffoldBackgroundColor: AppColors.background,

      // --------------------------------------------------------------------
      // TYPOGRAPHY
      // --------------------------------------------------------------------
      textTheme: _buildTextTheme(Brightness.light),

      // --------------------------------------------------------------------
      // APP BAR
      // --------------------------------------------------------------------
      appBarTheme: const AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 2,
        centerTitle: true,
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        surfaceTintColor: AppColors.primary,
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
        titleTextStyle: TextStyle(
          fontFamily: '.SF Pro Display',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.onSurface,
        ),
      ),

      // --------------------------------------------------------------------
      // BOTTOM NAVIGATION BAR
      // --------------------------------------------------------------------
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.onSurfaceVariant,
        elevation: 8,
        selectedLabelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          fontWeight: FontWeight.w400,
        ),
      ),

      // --------------------------------------------------------------------
      // NAVIGATION BAR (Material 3)
      // --------------------------------------------------------------------
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        elevation: 3,
        height: 80,
        indicatorColor: AppColors.primaryContainer,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              fontFamily: '.SF Pro Text',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            );
          }
          return const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 12,
            fontWeight: FontWeight.w400,
            color: AppColors.onSurfaceVariant,
          );
        }),
      ),

      // --------------------------------------------------------------------
      // CARDS
      // --------------------------------------------------------------------
      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        ),
        margin: const EdgeInsets.all(AppSpacing.cardMargin),
      ),

      // --------------------------------------------------------------------
      // ELEVATED BUTTONS
      // --------------------------------------------------------------------
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          ),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // FILLED BUTTONS
      // --------------------------------------------------------------------
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          ),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // OUTLINED BUTTONS
      // --------------------------------------------------------------------
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          ),
          side: const BorderSide(color: AppColors.outline),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // TEXT BUTTONS
      // --------------------------------------------------------------------
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // FAB
      // --------------------------------------------------------------------
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        ),
      ),

      // --------------------------------------------------------------------
      // INPUT DECORATION
      // --------------------------------------------------------------------
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceVariant,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.inputPadding,
          vertical: AppSpacing.inputPaddingSmall,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: const BorderSide(color: AppColors.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        labelStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.onSurfaceVariant,
        ),
        hintStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.onSurfaceVariant,
        ),
        errorStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          color: AppColors.error,
        ),
      ),

      // --------------------------------------------------------------------
      // CHIPS
      // --------------------------------------------------------------------
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceVariant,
        selectedColor: AppColors.primaryContainer,
        labelStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMicro),
        ),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      ),

      // --------------------------------------------------------------------
      // DIVIDERS
      // --------------------------------------------------------------------
      dividerTheme: const DividerThemeData(
        color: AppColors.outlineVariant,
        thickness: 1,
        space: 1,
      ),

      // --------------------------------------------------------------------
      // LIST TILES
      // --------------------------------------------------------------------
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(
          horizontal: AppSpacing.listItemPadding,
          vertical: AppSpacing.listItemSpacing / 2,
        ),
        minLeadingWidth: 24,
        horizontalTitleGap: AppSpacing.sm,
      ),

      // --------------------------------------------------------------------
      // BOTTOM SHEET
      // --------------------------------------------------------------------
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusBottomSheet),
          ),
        ),
        showDragHandle: true,
        dragHandleColor: AppColors.outlineVariant,
        dragHandleSize: Size(32, 4),
      ),

      // --------------------------------------------------------------------
      // DIALOG
      // --------------------------------------------------------------------
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
        ),
        titleTextStyle: const TextStyle(
          fontFamily: '.SF Pro Display',
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: AppColors.onSurface,
        ),
        contentTextStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.onSurfaceVariant,
        ),
      ),

      // --------------------------------------------------------------------
      // SNACK BAR
      // --------------------------------------------------------------------
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.onSurface,
        contentTextStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.surface,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
        ),
        behavior: SnackBarBehavior.floating,
      ),

      // --------------------------------------------------------------------
      // TAB BAR
      // --------------------------------------------------------------------
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.onSurfaceVariant,
        labelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          fontWeight: FontWeight.w400,
        ),
        indicator: UnderlineTabIndicator(
          borderSide: BorderSide(color: AppColors.primary, width: 3),
        ),
      ),

      // --------------------------------------------------------------------
      // PROGRESS INDICATORS
      // --------------------------------------------------------------------
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.surfaceVariant,
        circularTrackColor: AppColors.surfaceVariant,
      ),

      // --------------------------------------------------------------------
      // SWITCH
      // --------------------------------------------------------------------
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.onPrimary;
          }
          return AppColors.outline;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primary;
          }
          return AppColors.surfaceVariant;
        }),
      ),

      // --------------------------------------------------------------------
      // CHECKBOX
      // --------------------------------------------------------------------
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primary;
          }
          return Colors.transparent;
        }),
        checkColor: WidgetStateProperty.all(AppColors.onPrimary),
        side: const BorderSide(color: AppColors.outline, width: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),

      // --------------------------------------------------------------------
      // RADIO
      // --------------------------------------------------------------------
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primary;
          }
          return AppColors.outline;
        }),
      ),

      // --------------------------------------------------------------------
      // SLIDER
      // --------------------------------------------------------------------
      sliderTheme: const SliderThemeData(
        activeTrackColor: AppColors.primary,
        inactiveTrackColor: AppColors.surfaceVariant,
        thumbColor: AppColors.primary,
        overlayColor: Color(0x2900796B),
        valueIndicatorColor: AppColors.primary,
        valueIndicatorTextStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          color: AppColors.onPrimary,
        ),
      ),

      // --------------------------------------------------------------------
      // TOOLTIP
      // --------------------------------------------------------------------
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: AppColors.onSurface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMicro),
        ),
        textStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          color: AppColors.surface,
        ),
      ),

      // --------------------------------------------------------------------
      // PAGE TRANSITIONS
      // --------------------------------------------------------------------
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          TargetPlatform.iOS: const CupertinoPageTransitionsBuilder(),
          TargetPlatform.android: const ZoomPageTransitionsBuilder(),
        },
      ),
    );
  }

  // ==========================================================================
  // DARK THEME BUILDER
  // ==========================================================================

  static ThemeData _buildDarkTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,

      // --------------------------------------------------------------------
      // COLOR SCHEME
      // --------------------------------------------------------------------
      colorScheme: const ColorScheme.dark(
        primary: DesignColorsDark.actionPrimary,
        onPrimary: DesignColorsDark.onActionPrimary,
        primaryContainer: DesignColorsDark.actionPrimarySubtle,
        onPrimaryContainer: DesignColorsDark.text,

        secondary: AppColors.secondary,
        onSecondary: AppColors.onSecondary,
        secondaryContainer: AppColors.secondaryDark,
        onSecondaryContainer: AppColors.secondaryContainer,

        tertiary: AppColors.tertiaryLight,
        onTertiary: AppColors.tertiaryDark,
        tertiaryContainer: AppColors.tertiaryDark,
        onTertiaryContainer: AppColors.tertiaryContainer,

        error: AppColors.errorLight,
        onError: AppColors.onError,
        errorContainer: AppColors.error,
        onErrorContainer: AppColors.errorContainer,

        surface: AppColors.surfaceDark,
        onSurface: AppColors.onSurfaceDark,
        surfaceContainerHighest: AppColors.surfaceContainerHighDark,

        outline: AppColors.outlineDark,
        outlineVariant: AppColors.outlineVariantDark,
      ),

      // --------------------------------------------------------------------
      // SCAFFOLD
      // --------------------------------------------------------------------
      scaffoldBackgroundColor: AppColors.backgroundDark,

      // --------------------------------------------------------------------
      // TYPOGRAPHY
      // --------------------------------------------------------------------
      textTheme: _buildTextTheme(Brightness.dark),

      // --------------------------------------------------------------------
      // APP BAR
      // --------------------------------------------------------------------
      appBarTheme: const AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 2,
        centerTitle: true,
        backgroundColor: AppColors.surfaceDark,
        foregroundColor: AppColors.onSurfaceDark,
        surfaceTintColor: AppColors.primaryLight,
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        titleTextStyle: TextStyle(
          fontFamily: '.SF Pro Display',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.onSurfaceDark,
        ),
      ),

      // --------------------------------------------------------------------
      // BOTTOM NAVIGATION BAR
      // --------------------------------------------------------------------
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.surfaceDark,
        selectedItemColor: AppColors.primaryLight,
        unselectedItemColor: AppColors.onSurfaceVariantDark,
        elevation: 8,
        selectedLabelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          fontWeight: FontWeight.w400,
        ),
      ),

      // --------------------------------------------------------------------
      // NAVIGATION BAR (Material 3)
      // --------------------------------------------------------------------
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surfaceDark,
        elevation: 3,
        height: 80,
        indicatorColor: AppColors.primaryDark,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              fontFamily: '.SF Pro Text',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.primaryLight,
            );
          }
          return const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 12,
            fontWeight: FontWeight.w400,
            color: AppColors.onSurfaceVariantDark,
          );
        }),
      ),

      // --------------------------------------------------------------------
      // CARDS
      // --------------------------------------------------------------------
      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.surfaceContainerDark,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        ),
        margin: const EdgeInsets.all(AppSpacing.cardMargin),
      ),

      // --------------------------------------------------------------------
      // ELEVATED BUTTONS
      // --------------------------------------------------------------------
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primaryLight,
          foregroundColor: AppColors.primaryDark,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          ),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // FILLED BUTTONS
      // --------------------------------------------------------------------
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primaryLight,
          foregroundColor: AppColors.primaryDark,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          ),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // OUTLINED BUTTONS
      // --------------------------------------------------------------------
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryLight,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          ),
          side: const BorderSide(color: AppColors.outlineDark),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // TEXT BUTTONS
      // --------------------------------------------------------------------
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryLight,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.buttonPadding,
            vertical: AppSpacing.buttonPaddingSmall,
          ),
          textStyle: const TextStyle(
            fontFamily: '.SF Pro Text',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // --------------------------------------------------------------------
      // FAB
      // --------------------------------------------------------------------
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primaryLight,
        foregroundColor: AppColors.primaryDark,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
        ),
      ),

      // --------------------------------------------------------------------
      // INPUT DECORATION
      // --------------------------------------------------------------------
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceContainerDark,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.inputPadding,
          vertical: AppSpacing.inputPaddingSmall,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: const BorderSide(color: AppColors.primaryLight, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: const BorderSide(color: AppColors.errorLight, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
          borderSide: const BorderSide(color: AppColors.errorLight, width: 2),
        ),
        labelStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.onSurfaceVariantDark,
        ),
        hintStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.onSurfaceVariantDark,
        ),
        errorStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          color: AppColors.errorLight,
        ),
      ),

      // --------------------------------------------------------------------
      // CHIPS
      // --------------------------------------------------------------------
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceVariantDark,
        selectedColor: AppColors.primaryDark,
        labelStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusMicro),
        ),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      ),

      // --------------------------------------------------------------------
      // DIVIDERS
      // --------------------------------------------------------------------
      dividerTheme: const DividerThemeData(
        color: AppColors.outlineVariantDark,
        thickness: 1,
        space: 1,
      ),

      // --------------------------------------------------------------------
      // LIST TILES
      // --------------------------------------------------------------------
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(
          horizontal: AppSpacing.listItemPadding,
          vertical: AppSpacing.listItemSpacing / 2,
        ),
        minLeadingWidth: 24,
        horizontalTitleGap: AppSpacing.sm,
      ),

      // --------------------------------------------------------------------
      // BOTTOM SHEET
      // --------------------------------------------------------------------
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceDark,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusBottomSheet),
          ),
        ),
        showDragHandle: true,
        dragHandleColor: AppColors.outlineVariantDark,
        dragHandleSize: Size(32, 4),
      ),

      // --------------------------------------------------------------------
      // DIALOG
      // --------------------------------------------------------------------
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surfaceContainerDark,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXL),
        ),
        titleTextStyle: const TextStyle(
          fontFamily: '.SF Pro Display',
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: AppColors.onSurfaceDark,
        ),
        contentTextStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.onSurfaceVariantDark,
        ),
      ),

      // --------------------------------------------------------------------
      // SNACK BAR
      // --------------------------------------------------------------------
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.onSurfaceDark,
        contentTextStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          color: AppColors.surfaceDark,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
        ),
        behavior: SnackBarBehavior.floating,
      ),

      // --------------------------------------------------------------------
      // TAB BAR
      // --------------------------------------------------------------------
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.primaryLight,
        unselectedLabelColor: AppColors.onSurfaceVariantDark,
        labelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 14,
          fontWeight: FontWeight.w400,
        ),
        indicator: UnderlineTabIndicator(
          borderSide: BorderSide(color: AppColors.primaryLight, width: 3),
        ),
      ),

      // --------------------------------------------------------------------
      // PROGRESS INDICATORS
      // --------------------------------------------------------------------
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primaryLight,
        linearTrackColor: AppColors.surfaceVariantDark,
        circularTrackColor: AppColors.surfaceVariantDark,
      ),

      // --------------------------------------------------------------------
      // SWITCH
      // --------------------------------------------------------------------
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primaryDark;
          }
          return AppColors.outlineDark;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primaryLight;
          }
          return AppColors.surfaceVariantDark;
        }),
      ),

      // --------------------------------------------------------------------
      // CHECKBOX
      // --------------------------------------------------------------------
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primaryLight;
          }
          return Colors.transparent;
        }),
        checkColor: WidgetStateProperty.all(AppColors.primaryDark),
        side: const BorderSide(color: AppColors.outlineDark, width: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),

      // --------------------------------------------------------------------
      // RADIO
      // --------------------------------------------------------------------
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.primaryLight;
          }
          return AppColors.outlineDark;
        }),
      ),

      // --------------------------------------------------------------------
      // SLIDER
      // --------------------------------------------------------------------
      sliderTheme: const SliderThemeData(
        activeTrackColor: AppColors.primaryLight,
        inactiveTrackColor: AppColors.surfaceVariantDark,
        thumbColor: AppColors.primaryLight,
        overlayColor: Color(0x2948A999),
        valueIndicatorColor: AppColors.primaryLight,
        valueIndicatorTextStyle: TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          color: AppColors.primaryDark,
        ),
      ),

      // --------------------------------------------------------------------
      // TOOLTIP
      // --------------------------------------------------------------------
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: AppColors.onSurfaceDark,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMicro),
        ),
        textStyle: const TextStyle(
          fontFamily: '.SF Pro Text',
          fontSize: 12,
          color: AppColors.surfaceDark,
        ),
      ),

      // --------------------------------------------------------------------
      // PAGE TRANSITIONS
      // --------------------------------------------------------------------
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          TargetPlatform.iOS: const CupertinoPageTransitionsBuilder(),
          TargetPlatform.android: const ZoomPageTransitionsBuilder(),
        },
      ),
    );
  }

  // ==========================================================================
  // TEXT THEME BUILDER
  // ==========================================================================

  static TextTheme _buildTextTheme(Brightness brightness) {
    final bool isDark = brightness == Brightness.dark;
    final Color textColor = isDark
        ? AppColors.onSurfaceDark
        : AppColors.onSurface;
    final Color secondaryTextColor = isDark
        ? AppColors.onSurfaceVariantDark
        : AppColors.onSurfaceVariant;

    return TextTheme(
      displayLarge: TextStyle(
        fontFamily: '.SF Pro Display',
        fontSize: 57,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.25,
        height: 1.12,
        color: textColor,
      ),
      displayMedium: TextStyle(
        fontFamily: '.SF Pro Display',
        fontSize: 45,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        height: 1.16,
        color: textColor,
      ),
      displaySmall: TextStyle(
        fontFamily: '.SF Pro Display',
        fontSize: 36,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        height: 1.22,
        color: textColor,
      ),
      headlineLarge: TextStyle(
        fontFamily: '.SF Pro Display',
        fontSize: 32,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        height: 1.25,
        color: textColor,
      ),
      headlineMedium: TextStyle(
        fontFamily: '.SF Pro Display',
        fontSize: 28,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        height: 1.29,
        color: textColor,
      ),
      headlineSmall: TextStyle(
        fontFamily: '.SF Pro Display',
        fontSize: 24,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        height: 1.33,
        color: textColor,
      ),
      titleLarge: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 22,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        height: 1.27,
        color: textColor,
      ),
      titleMedium: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.15,
        height: 1.5,
        color: textColor,
      ),
      titleSmall: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.1,
        height: 1.43,
        color: textColor,
      ),
      bodyLarge: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 16,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.5,
        height: 1.5,
        color: textColor,
      ),
      bodyMedium: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.25,
        height: 1.43,
        color: textColor,
      ),
      bodySmall: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 12,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.4,
        height: 1.33,
        color: secondaryTextColor,
      ),
      labelLarge: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        height: 1.43,
        color: textColor,
      ),
      labelMedium: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 12,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.5,
        height: 1.33,
        color: textColor,
      ),
      labelSmall: TextStyle(
        fontFamily: '.SF Pro Text',
        fontSize: 11,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.5,
        height: 1.45,
        color: secondaryTextColor,
      ),
    );
  }
}
