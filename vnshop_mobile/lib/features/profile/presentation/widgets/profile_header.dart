import 'package:flutter/material.dart';

import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../l10n/generated/app_localizations.dart';

/// Profile header widget with avatar and user info
class ProfileHeader extends StatelessWidget {
  final String? avatarUrl;
  final String? name;
  final String? phone;
  final VoidCallback? onEditTap;
  final VoidCallback? onAvatarTap;

  const ProfileHeader({
    super.key,
    this.avatarUrl,
    this.name,
    this.phone,
    this.onEditTap,
    this.onAvatarTap,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.primary.withValues(alpha: 0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar
                Semantics(
                  button: onAvatarTap != null,
                  label: l10n.edit,
                  child: GestureDetector(
                    onTap: onAvatarTap,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: avatarUrl != null && avatarUrl!.isNotEmpty
                              ? SafeNetworkImage(
                                  url: avatarUrl,
                                  fit: BoxFit.cover,
                                  width: 80,
                                  height: 80,
                                  semanticLabel: name ?? l10n.customerReviews,
                                  errorWidget: _buildPlaceholderAvatar(),
                                )
                              : _buildPlaceholderAvatar(),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // User info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name ?? l10n.customerReviews,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (phone != null && phone!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.phone_outlined,
                              color: Colors.white70,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              phone!,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                // Edit button
                if (onEditTap != null)
                  Material(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      onTap: onEditTap,
                      borderRadius: BorderRadius.circular(8),
                      child: const SizedBox(
                        width: 48,
                        height: 48,
                        child: Padding(
                          padding: EdgeInsets.all(14),
                          child: Icon(
                            Icons.edit_outlined,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderAvatar() {
    return Container(
      color: Colors.grey.shade300,
      child: const Center(
        child: Icon(Icons.person, size: 40, color: Colors.grey),
      ),
    );
  }
}

/// Compact profile header for settings page
class ProfileHeaderCompact extends StatelessWidget {
  final String? avatarUrl;
  final String? name;
  final String? email;
  final VoidCallback? onEditTap;

  const ProfileHeaderCompact({
    super.key,
    this.avatarUrl,
    this.name,
    this.email,
    this.onEditTap,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        // Avatar
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: Theme.of(
                context,
              ).colorScheme.primary.withValues(alpha: 0.3),
              width: 2,
            ),
          ),
          child: ClipOval(
            child: avatarUrl != null && avatarUrl!.isNotEmpty
                ? SafeNetworkImage(
                    url: avatarUrl,
                    fit: BoxFit.cover,
                    width: 60,
                    height: 60,
                    errorWidget: _buildPlaceholderAvatar(),
                  )
                : _buildPlaceholderAvatar(),
          ),
        ),
        const SizedBox(width: 16),
        // User info
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name ?? l10n.customerReviews,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (email != null && email!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  email!,
                  style: TextStyle(
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.6),
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
        // Edit button
        if (onEditTap != null)
          IconButton(
            onPressed: onEditTap,
            icon: Icon(
              Icons.edit_outlined,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
      ],
    );
  }

  Widget _buildPlaceholderAvatar() {
    return Container(
      color: Colors.grey.shade200,
      child: Center(
        child: Icon(Icons.person, size: 30, color: Colors.grey.shade400),
      ),
    );
  }
}
