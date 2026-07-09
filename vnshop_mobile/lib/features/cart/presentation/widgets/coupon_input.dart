import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CouponInput extends StatefulWidget {
  final String? appliedCoupon;
  final ValueChanged<String> onApply;
  final VoidCallback onRemove;
  final bool isLoading;
  final String? errorMessage;

  const CouponInput({
    super.key,
    this.appliedCoupon,
    required this.onApply,
    required this.onRemove,
    this.isLoading = false,
    this.errorMessage,
  });

  @override
  State<CouponInput> createState() => _CouponInputState();
}

class _CouponInputState extends State<CouponInput> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    if (widget.appliedCoupon != null) {
      _controller.text = widget.appliedCoupon!;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleApply() {
    final code = _controller.text.trim().toUpperCase();
    if (code.isNotEmpty) {
      widget.onApply(code);
      _focusNode.unfocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isApplied = widget.appliedCoupon != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                enabled: !isApplied && !widget.isLoading,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'Nhập mã giảm giá',
                  prefixIcon: const Icon(Icons.local_offer_outlined),
                  suffixIcon: _controller.text.isNotEmpty && !isApplied
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _controller.clear();
                            setState(() {});
                          },
                        )
                      : null,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _handleApply(),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 48,
              child: widget.isLoading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : isApplied
                      ? FilledButton.tonal(
                          onPressed: widget.onRemove,
                          child: const Text('Xóa'),
                        )
                      : FilledButton(
                          onPressed: _controller.text.trim().isNotEmpty
                              ? _handleApply
                              : null,
                          child: const Text('Áp dụng'),
                        ),
            ),
          ],
        ),
        if (widget.errorMessage != null) ...[
          const SizedBox(height: 8),
          Text(
            widget.errorMessage!,
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontSize: 12,
            ),
          ),
        ],
        if (isApplied) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.check_circle,
                  color: Colors.green.shade700,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Đã áp dụng mã: ${widget.appliedCoupon}',
                    style: TextStyle(
                      color: Colors.green.shade700,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class CouponDiscountDisplay extends StatelessWidget {
  final String code;
  final double amount;
  final VoidCallback? onRemove;
  final bool isLoading;

  const CouponDiscountDisplay({
    super.key,
    required this.code,
    required this.amount,
    this.onRemove,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: '₫',
      decimalDigits: 0,
    );

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.green.shade200),
      ),
      child: Row(
        children: [
          Icon(
            Icons.local_offer,
            color: Colors.green.shade700,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mã: $code',
                  style: TextStyle(
                    color: Colors.green.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '-${formatter.format(amount)}',
                  style: TextStyle(
                    color: Colors.green.shade700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          if (onRemove != null && !isLoading)
            IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: onRemove,
              color: Colors.green.shade700,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          if (isLoading)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }
}
