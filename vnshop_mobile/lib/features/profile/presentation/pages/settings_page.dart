import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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
  String _selectedLanguage = 'Tiếng Việt';

  final List<Map<String, String>> _languages = [
    {'code': 'vi', 'name': 'Tiếng Việt'},
    {'code': 'en', 'name': 'English'},
  ];

  @override
  Widget build(BuildContext context) {
    // Mock user data
    const avatarUrl = 'https://i.pravatar.cc/150?img=1';
    const name = 'Nguyễn Văn A';
    const email = 'nguyenvana@email.com';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cài đặt'),
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

            const ProfileMenuSection(title: 'Thông báo'),

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
                    title: 'Bật thông báo',
                    subtitle: 'Nhận thông báo từ ứng dụng',
                    value: _notificationsEnabled,
                    onChanged: (value) {
                      setState(() => _notificationsEnabled = value);
                    },
                    iconColor: Colors.orange,
                  ),
                  ProfileMenuToggle(
                    icon: Icons.local_shipping_outlined,
                    title: 'Cập nhật đơn hàng',
                    subtitle: 'Thông báo trạng thái đơn hàng',
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
                    title: 'Khuyến mãi',
                    subtitle: 'Mã giảm giá, ưu đãi đặc biệt',
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

            const ProfileMenuSection(title: 'Giao diện'),

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
                    title: 'Chế độ tối',
                    subtitle: 'Giao diện tối cho mắt dễ chịu',
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
                    title: 'Ngôn ngữ',
                    subtitle: _selectedLanguage,
                    iconColor: Colors.teal,
                    onTap: () => _showLanguageBottomSheet(context),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _selectedLanguage,
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

            const ProfileMenuSection(title: 'Khác'),

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
                    title: 'Chính sách bảo mật',
                    iconColor: Colors.blueGrey,
                    onTap: () => context.push('/privacy-policy'),
                  ),
                  ProfileMenuItem(
                    icon: Icons.description_outlined,
                    title: 'Điều khoản sử dụng',
                    iconColor: Colors.grey.shade700,
                    onTap: () => context.push('/terms'),
                  ),
                  ProfileMenuItem(
                    icon: Icons.delete_outline,
                    title: 'Xóa tài khoản',
                    subtitle: 'Xóa vĩnh viễn tài khoản và dữ liệu',
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
                    'VNShop v1.0.0',
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
                    'Made with ❤️ in Vietnam',
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
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Icon(Icons.language_outlined),
                    SizedBox(width: 8),
                    Text(
                      'Chọn ngôn ngữ',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              ...List.generate(_languages.length, (index) {
                final language = _languages[index];
                final isSelected = language['name'] == _selectedLanguage;
                return ListTile(
                  leading: Icon(
                    isSelected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                    color: isSelected
                        ? Theme.of(context).colorScheme.primary
                        : Colors.grey,
                  ),
                  title: Text(language['name']!),
                  onTap: () {
                    setState(() => _selectedLanguage = language['name']!);
                    Navigator.pop(context);
                    _showLanguageChangeSnackbar(context, language['name']!);
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          enabled
              ? 'Đã bật chế độ tối'
              : 'Đã tắt chế độ tối',
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showLanguageChangeSnackbar(BuildContext context, String language) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Ngôn ngữ đã được đổi sang $language'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
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
            const Text('Xóa tài khoản'),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bạn có chắc chắn muốn xóa tài khoản không?',
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            SizedBox(height: 12),
            Text(
              '⚠️ Lưu ý:',
              style: TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 4),
            Text(
              '• Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn\n'
              '• Không thể khôi phục lại sau khi xóa\n'
              '• Bạn sẽ mất quyền truy cập vào đơn hàng cũ',
              style: TextStyle(fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement account deletion
              _showAccountDeletedSnackbar(context);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Xóa tài khoản'),
          ),
        ],
      ),
    );
  }

  void _showAccountDeletedSnackbar(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
          'Yêu cầu xóa tài khoản đã được gửi. Vui lòng xác nhận qua email.',
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.orange,
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
