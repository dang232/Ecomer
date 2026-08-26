import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/generated/app_localizations.dart';

import '../../../../core/theme/app_colors.dart';
import '../widgets/profile_header.dart';
import '../widgets/profile_menu_item.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    // Mock user data - in real app, get from AuthBloc
    const avatarUrl = 'https://i.pravatar.cc/150?img=1';
    const name = 'Nguyễn Văn A';
    const phone = '0912 345 678';
    
    // Mock order counts
    const pendingCount = 2;
    const processingCount = 1;
    const shippedCount = 0;
    const totalActiveOrders = pendingCount + processingCount + shippedCount;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Profile Header
          SliverToBoxAdapter(
            child: ProfileHeader(
              avatarUrl: avatarUrl,
              name: name,
              phone: phone,
              onEditTap: () => context.push('/profile/edit'),
              onAvatarTap: () => context.push('/profile/edit'),
            ),
          ),
          
          // Menu Content
          SliverToBoxAdapter(
            child: Container(
              color: Colors.grey.shade100,
              child: Column(
                children: [
                  const SizedBox(height: 16),
                  
                  // Orders Section
                   _buildOrdersSection(context, totalActiveOrders, l10n),
                  
                  const SizedBox(height: 16),
                  
                  // Main Menu Section
                   _buildMainMenuSection(context, l10n),
                  
                  const SizedBox(height: 16),
                  
                  // Support Section
                   _buildSupportSection(context, l10n),
                  
                  const SizedBox(height: 16),
                  
                  // Logout Button
                   _buildLogoutButton(context, l10n),
                  
                  const SizedBox(height: 32),
                  
                  // App Version
                   _buildAppVersion(context, l10n),
                  
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrdersSection(BuildContext context, int activeOrders, AppLocalizations l10n) {
    return Container(
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
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                  Text(
                  l10n.myOrders,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (activeOrders > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.saleBadge,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      l10n.activeOrders(activeOrders),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          
          // Order Status Grid
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                _buildOrderStatusItem(
                  context,
                  icon: Icons.pending_actions_outlined,
                   label: l10n.orderStatusPendingShort,
                  count: 2,
                  color: Colors.orange,
                  onTap: () => context.push('/orders?status=pending'),
                ),
                _buildOrderStatusItem(
                  context,
                  icon: Icons.inventory_2_outlined,
                   label: l10n.orderStatusProcessingShort,
                  count: 1,
                  color: Colors.blue,
                  onTap: () => context.push('/orders?status=processing'),
                ),
                _buildOrderStatusItem(
                  context,
                  icon: Icons.local_shipping_outlined,
                   label: l10n.orderStatusShippedShort,
                  count: 0,
                  color: Colors.purple,
                  onTap: () => context.push('/orders?status=shipped'),
                ),
                _buildOrderStatusItem(
                  context,
                  icon: Icons.check_circle_outline,
                   label: l10n.orderStatusDeliveredShort,
                  count: 5,
                  color: Colors.green,
                  onTap: () => context.push('/orders?status=delivered'),
                ),
              ],
            ),
          ),
          
          const Divider(height: 1),
          
          // View All Orders
          InkWell(
            onTap: () => context.push('/orders'),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    l10n.viewAllOrders,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderStatusItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required int count,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          children: [
            Stack(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    icon,
                    color: color,
                    size: 24,
                  ),
                ),
                if (count > 0)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      child: Text(
                        count > 9 ? '9+' : count.toString(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: Colors.black87,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainMenuSection(BuildContext context, AppLocalizations l10n) {
    return Container(
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
            icon: Icons.favorite_outline,
             title: l10n.favoriteProducts,
            iconColor: Colors.pink,
            onTap: () => context.push('/favorites'),
          ),
          ProfileMenuItem(
            icon: Icons.location_on_outlined,
             title: l10n.addressBook,
             subtitle: l10n.addressBookHelp,
            iconColor: Colors.green,
            onTap: () => context.push('/addresses'),
          ),
          ProfileMenuItem(
            icon: Icons.payment_outlined,
             title: l10n.paymentMethods,
             subtitle: l10n.paymentMethodsHelp,
            iconColor: Colors.blue,
            onTap: () => context.push('/payment-methods'),
          ),
          ProfileMenuItem(
            icon: Icons.notifications_outlined,
             title: l10n.notificationsSettings,
             subtitle: l10n.notificationsSettingsHelp,
            badge: 3,
            iconColor: Colors.orange,
            onTap: () => context.push('/notifications'),
            showDivider: false,
          ),
        ],
      ),
    );
  }

  Widget _buildSupportSection(BuildContext context, AppLocalizations l10n) {
    return Container(
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
            icon: Icons.settings_outlined,
             title: l10n.settingsTitle,
            iconColor: Colors.grey.shade700,
            onTap: () => context.push('/settings'),
          ),
          ProfileMenuItem(
            icon: Icons.help_outline,
             title: l10n.help,
             subtitle: l10n.helpDescription,
            iconColor: Colors.teal,
            onTap: () => context.push('/help'),
          ),
          ProfileMenuItem(
            icon: Icons.info_outline,
             title: l10n.about,
             subtitle: l10n.aboutSubtitle,
            iconColor: Colors.blueGrey,
            onTap: () => _showAboutDialog(context),
            showDivider: false,
          ),
        ],
      ),
    );
  }

  Widget _buildLogoutButton(BuildContext context, AppLocalizations l10n) {
    return Container(
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showLogoutDialog(context),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.logout,
                  color: Colors.red.shade600,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Text(
                  l10n.logout,
                  style: TextStyle(
                    color: Colors.red.shade600,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppVersion(BuildContext context, AppLocalizations l10n) {
    return Text(
      l10n.aboutSubtitle,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
        fontSize: 12,
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.shopping_bag,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Text('VNShop'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.aboutVersion),
            SizedBox(height: 8),
            Text(
              l10n.aboutDescription,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.close),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.logout),
        content: Text(l10n.logoutQuestion),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.cancel),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement logout
              context.go('/login');
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: Text(l10n.logout),
          ),
        ],
      ),
    );
  }
}
