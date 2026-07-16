import 'package:flutter/material.dart';

import '../../data/models/payment_transaction.dart';
import 'payment_method_card.dart';

class PaymentMethodSelector extends StatelessWidget {
  const PaymentMethodSelector({
    super.key,
    required this.methods,
    required this.onMethodSelected,
    this.selectedMethod,
  });

  final List<PaymentMethod> methods;
  final PaymentMethod? selectedMethod;
  final ValueChanged<PaymentMethod> onMethodSelected;

  @override
  Widget build(BuildContext context) {
    return RadioGroup<PaymentMethod>(
      groupValue: selectedMethod,
      onChanged: (method) {
        if (method != null) onMethodSelected(method);
      },
      child: Column(
        children: [
          for (final method in methods)
            PaymentMethodCard(
              method: method,
              isSelected: method == selectedMethod,
              onTap: () => onMethodSelected(method),
            ),
        ],
      ),
    );
  }
}
