import 'package:flutter/material.dart';

import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../common/widgets/images/safe_network_image.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/models/payment_transaction.dart';

class SepaySection extends StatelessWidget {
  const SepaySection({required this.transaction, required this.onCheckStatus, super.key});

  final PaymentTransaction transaction;
  final VoidCallback onCheckStatus;

  @override
  Widget build(BuildContext context) {
    final qrUrl = transaction.qrCodeUrl;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Thanh toán SePay', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            const Text('Quét mã QR, chuyển đúng số tiền và giữ nguyên nội dung chuyển khoản.'),
            if (qrUrl != null && qrUrl.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Semantics(
                label: 'Mã QR thanh toán SePay',
                image: true,
                child: Center(child: SafeNetworkImage(url: qrUrl, width: 240, height: 240)),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            Text('Trạng thái: ${transaction.statusLabel}'),
            const SizedBox(height: AppSpacing.sm),
            VnPrimaryButton(
              onPressed: onCheckStatus,
              label: 'Kiểm tra trạng thái',
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
      ),
    );
  }
}
