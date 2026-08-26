import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/app.dart';
import '../../../../l10n/generated/app_localizations.dart';

import '../widgets/profile_header.dart';
import '../widgets/profile_menu_item.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _notificationsEnabled = true;
  bool _orderUpdates = true;
  bool _promotions = false;
  bool _darkMode = false;
  Locale _selectedLocale = const Locale('vi');

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    // Mock user data
    const avatarUrl = 'https://i.pravatar.cc/150?img=1';
    const name = 'Nguyễn Văn A';
    const email = 'nguyenvana@email.com';

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settingsTitle),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile Info Section
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: ProfileHeaderCompact(
                avatarUrl: avatarUrl,
                name: name,
                email: email,
                onEditTap: () => context.push('/profile/edit'),
              ),
            ),

            ProfileMenuSection(title: l10n.settingsNotificationsSection),

            // Notification Settings
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  ProfileMenuToggle(
                    icon: Icons.notifications_outlined,
                    title: l10n.settingsEnableNotifications,
                    subtitle: l10n.settingsNotificationsHelp,
                    value: _notificationsEnabled,
                    onChanged: (value) {
                      setState(() => _notificationsEnabled = value);
                    },
                    iconColor: Colors.orange,
                  ),
                  ProfileMenuToggle(
                    icon: Icons.local_shipping_outlined,
                    title: l10n.settingsOrderUpdates,
                    subtitle: l10n.settingsOrderUpdatesHelp,
                    value: _orderUpdates,
                    onChanged: _notificationsEnabled
                        ? (value) {
                            setState(() => _orderUpdates = value);
                          }
                        : null,
                    iconColor: Colors.blue,
                  ),
                  ProfileMenuToggle(
                    icon: Icons.campaign_outlined,
                    title: l10n.settingsPromotions,
                    subtitle: l10n.settingsPromotionsHelp,
                    value: _promotions,
                    onChanged: _notificationsEnabled
                        ? (value) {
                            setState(() => _promotions = value);
                          }
                        : null,
                    iconColor: Colors.red,
                  ),
                ],
              ),
            ),

            ProfileMenuSection(title: l10n.settingsAppearanceSection),

            // Appearance Settings
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  ProfileMenuToggle(
                    icon: Icons.dark_mode_outlined,
                    title: l10n.settingsDarkMode,
                    subtitle: l10n.settingsDarkModeHelp,
                    value: _darkMode,
                    onChanged: (value) {
                      setState(() => _darkMode = value);
                      // TODO: Implement theme change
                      _showThemeChangeSnackbar(context, value);
                    },
                    iconColor: Colors.indigo,
                  ),
                  ProfileMenuItem(
                    icon: Icons.language_outlined,
                    title: l10n.settingsLanguage,
                    subtitle: _selectedLocale.languageCode == 'vi' ? l10n.languageVietnamese : l10n.languageEnglish,
                    iconColor: Colors.teal,
                    onTap: () => _showLanguageBottomSheet(context),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                           _selectedLocale.languageCode == 'vi' ? l10n.languageVietnamese : l10n.languageEnglish,
                          style: TextStyle(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.6),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.chevron_right,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.4),
                        ),
                      ],
                    ),
                    showDivider: false,
                  ),
                ],
              ),
            ),

            ProfileMenuSection(title: l10n.settingsOtherSection),

            // Other Settings
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  ProfileMenuItem(
                    icon: Icons.privacy_tip_outlined,
                    title: l10n.privacyPolicy,
                    iconColor: Colors.blueGrey,
                    onTap: () => context.push('/privacy-policy'),
                  ),
                  ProfileMenuItem(
                    icon: Icons.description_outlined,
                    title: l10n.termsOfUse,
                    iconColor: Colors.grey.shade700,
                    onTap: () => context.push('/terms'),
                  ),
                  ProfileMenuItem(
                    icon: Icons.delete_outline,
                    title: l10n.deleteAccount,
                    subtitle: l10n.deleteAccountHelp,
                    iconColor: Colors.red,
                    onTap: () => _showDeleteAccountDialog(context),
                    showDivider: false,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // App Version
            Center(
              child: Column(
                children: [
                  Text(
                    l10n.aboutSubtitle,
                    style: TextStyle(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.5),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.madeWithLove,
                    style: TextStyle(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.3),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  void _showLanguageBottomSheet(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Icon(Icons.language_outlined),
                    SizedBox(width: 8),
                    Text(
                      l10n.chooseLanguage,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              ...[const Locale('vi'), const Locale('en')].map((locale) {
                final name = locale.languageCode == 'vi' ? l10n.languageVietnamese : l10n.languageEnglish;
                final isSelected = locale == _selectedLocale;
                return ListTile(
                  leading: Icon(
                    isSelected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: isSelected
                        ? Theme.of(context).colorScheme.primary
                        : Colors.grey,
                  ),
                  title: Text(name),
                  onTap: () {
                    setState(() => _selectedLocale = locale);
                    VnShopApp.localeController.setLocale(locale);
                    Navigator.pop(context);
                    _showLanguageChangeSnackbar(context, name);
                  },
                );
              }),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  void _showThemeChangeSnackbar(BuildContext context, bool enabled) {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          enabled
              ? l10n.darkModeEnabled
              : l10n.darkModeDisabled,
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showLanguageChangeSnackbar(BuildContext context, String language) {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.languageChanged(language)),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              Icons.warning_amber_rounded,
              color: Colors.red.shade700,
            ),
            const SizedBox(width: 8),
            Text(l10n.deleteAccount),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.deleteAccountQuestion,
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            SizedBox(height: 12),
            Text(
              l10n.deleteAccountWarning,
              style: TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 4),
            Text(
              l10n.deleteAccountConsequences,
              style: TextStyle(fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement account deletion
              _showAccountDeletedSnackbar(context);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: Text(l10n.deleteAccount),
          ),
        ],
      ),
    );
  }

  void _showAccountDeletedSnackbar(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.deleteAccountRequested),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.orange,
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
