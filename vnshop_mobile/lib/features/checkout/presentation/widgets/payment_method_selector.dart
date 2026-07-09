import 'package:flutter/material.dart';

import '../../data/models/payment_transaction.dart';

class PaymentMethodSelector extends StatelessWidget {
  final PaymentMethod? selectedMethod;
  final ValueChanged<PaymentMethod> onMethodSelected;

  const PaymentMethodSelector({
    super.key,
    this.selectedMethod,
    required this.onMethodSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Phương thức thanh toán',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 8),
        _PaymentMethodTile(
          method: PaymentMethod.vnpay,
          isSelected: selectedMethod == PaymentMethod.vnpay,
          onTap: () => onMethodSelected(PaymentMethod.vnpay),
        ),
        _PaymentMethodTile(
          method: PaymentMethod.momo,
          isSelected: selectedMethod == PaymentMethod.momo,
          onTap: () => onMethodSelected(PaymentMethod.momo),
        ),
        _PaymentMethodTile(
          method: PaymentMethod.vietqr,
          isSelected: selectedMethod == PaymentMethod.vietqr,
          onTap: () => onMethodSelected(PaymentMethod.vietqr),
        ),
        _PaymentMethodTile(
          method: PaymentMethod.cod,
          isSelected: selectedMethod == PaymentMethod.cod,
          onTap: () => onMethodSelected(PaymentMethod.cod),
        ),
      ],
    );
  }
}

class _PaymentMethodTile extends StatelessWidget {
  final PaymentMethod method;
  final bool isSelected;
  final VoidCallback onTap;

  const _PaymentMethodTile({
    required this.method,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      elevation: isSelected ? 2 : 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected
              ? Theme.of(context).colorScheme.primary
              : Colors.grey.shade300,
          width: isSelected ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected
                        ? Theme.of(context).colorScheme.primary
                        : Colors.grey.shade400,
                    width: isSelected ? 2 : 1.5,
                  ),
                  color: isSelected
                      ? Theme.of(context).colorScheme.primary
                      : Colors.transparent,
                ),
                child: isSelected
                    ? const Icon(Icons.check, size: 16, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _getMethodColor(method).withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  _getMethodIcon(method),
                  size: 24,
                  color: _getMethodColor(method),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getMethodName(method),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      _getMethodDescription(method),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                Icon(
                  Icons.check_circle,
                  color: Theme.of(context).colorScheme.primary,
                  size: 24,
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _getMethodName(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return 'VNPay';
      case PaymentMethod.momo:
        return 'MoMo';
      case PaymentMethod.vietqr:
        return 'VietQR';
      case PaymentMethod.cod:
        return 'Thanh toán khi nhận hàng';
      case PaymentMethod.bankTransfer:
        return 'Chuyển khoản ngân hàng';
    }
  }

  String _getMethodDescription(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return 'Thanh toán qua cổng VNPay';
      case PaymentMethod.momo:
        return 'Thanh toán qua ví MoMo';
      case PaymentMethod.vietqr:
        return 'Quét mã QR VietQR từ ngân hàng';
      case PaymentMethod.cod:
        return 'Trả tiền mặt khi nhận hàng';
      case PaymentMethod.bankTransfer:
        return 'Chuyển khoản trực tiếp';
    }
  }

  IconData _getMethodIcon(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return Icons.account_balance;
      case PaymentMethod.momo:
        return Icons.phone_android;
      case PaymentMethod.vietqr:
        return Icons.qr_code_2;
      case PaymentMethod.cod:
        return Icons.local_shipping_outlined;
      case PaymentMethod.bankTransfer:
        return Icons.account_balance_wallet;
    }
  }

  Color _getMethodColor(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.vnpay:
        return Colors.indigo;
      case PaymentMethod.momo:
        return Colors.pink;
      case PaymentMethod.vietqr:
        return Colors.blue;
      case PaymentMethod.cod:
        return Colors.orange;
      case PaymentMethod.bankTransfer:
        return Colors.green;
    }
  }
}
