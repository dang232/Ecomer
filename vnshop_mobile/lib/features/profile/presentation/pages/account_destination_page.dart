import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';

class AccountDestinationPage extends StatelessWidget {
  const AccountDestinationPage({required this.title, required this.icon, required this.message, super.key});

  final String title;
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  Icon(icon, size: 48, color: colors.primary),
                  const SizedBox(height: AppSpacing.md),
                  Text(title, style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.sm),
                  Text(message, style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
