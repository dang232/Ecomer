import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../cart/presentation/bloc/cart_bloc.dart';
import '../../../cart/presentation/bloc/cart_event.dart';
import '../../data/models/address_model.dart';
import '../../data/models/payment_transaction.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import '../widgets/address_card.dart';
import '../widgets/checkout_bottom_bar.dart';
import '../widgets/order_summary_sheet.dart';
import '../widgets/payment_method_card.dart';
import '../widgets/shipping_method_card.dart';

/// Main checkout page with all checkout steps
class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key});

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  int _currentStep = 0;

  @override
  void initState() {
    super.initState();
    _initializeCheckout();
  }

  void _initializeCheckout() {
    final cartState = context.read<CartBloc>().state;
    context.read<CheckoutBloc>().add(CheckoutStarted(
          subtotal: cartState.subtotal,
          discountAmount: cartState.discountAmount,
          couponCode: cartState.appliedCouponCode,
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thanh toán'),
        centerTitle: true,
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: BlocConsumer<CheckoutBloc, CheckoutState>(
        listener: (context, state) {
          if (state.status == CheckoutStatus.orderPlaced) {
            _showOrderSuccessBottomSheet(context, state.orderId);
          } else if (state.status == CheckoutStatus.error &&
              state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage!),
                backgroundColor: AppColors.error,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state.status == CheckoutStatus.loading) {
            return const Center(child: CircularProgressIndicator());
          }

          return Column(
            children: [
              // Step indicators
              _StepIndicator(currentStep: _currentStep),

              // Content
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.only(bottom: 120),
                  children: [
                    // Step 1: Address
                    _buildStepSection(
                      step: 0,
                      title: 'Địa chỉ giao hàng',
                      icon: Icons.location_on_outlined,
                      child: _AddressSection(state: state),
                    ),

                    // Step 2: Shipping
                    _buildStepSection(
                      step: 1,
                      title: 'Phương thức vận chuyển',
                      icon: Icons.local_shipping_outlined,
                      child: _ShippingSection(state: state),
                    ),

                    // Step 3: Payment
                    _buildStepSection(
                      step: 2,
                      title: 'Phương thức thanh toán',
                      icon: Icons.payment_outlined,
                      child: _PaymentSection(state: state),
                    ),

                    // Step 4: Order Summary
                    _buildStepSection(
                      step: 3,
                      title: 'Tóm tắt đơn hàng',
                      icon: Icons.receipt_long_outlined,
                      child: _OrderSummarySection(state: state),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
      bottomSheet: BlocBuilder<CheckoutBloc, CheckoutState>(
        builder: (context, state) {
          return CheckoutBottomBar(
            totalAmount: state.totalAmount,
            isEnabled: state.canPlaceOrder,
            isLoading: state.isProcessingPayment,
            paymentMethod: state.selectedPaymentMethod,
            onPlaceOrder: () {
              context.read<CheckoutBloc>().add(const CheckoutPaymentInitiated());
            },
          );
        },
      ),
    );
  }

  Widget _buildStepSection({
    required int step,
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    final isActive = _currentStep >= step;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        color: isActive ? AppColors.surface : AppColors.surfaceVariant.withAlpha(128),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header
          InkWell(
            onTap: () {
              setState(() {
                _currentStep = step;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: _currentStep == step
                          ? AppColors.primary
                          : AppColors.primary.withAlpha(25),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
                    ),
                    child: Icon(
                      icon,
                      size: 20,
                      color: _currentStep == step
                          ? AppColors.onPrimary
                          : AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: _currentStep == step
                            ? AppColors.onSurface
                            : AppColors.onSurfaceVariant,
                      ),
                    ),
                  ),
                  if (_currentStep == step)
                    const Icon(
                      Icons.expand_less,
                      color: AppColors.primary,
                    )
                  else
                    const Icon(
                      Icons.expand_more,
                      color: AppColors.onSurfaceVariant,
                    ),
                ],
              ),
            ),
          ),

          // Section content (only show if this step is active)
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 300),
            crossFadeState: _currentStep == step
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            firstChild: child,
            secondChild: const SizedBox.shrink(),
          ),

          const Divider(height: 1),
        ],
      ),
    );
  }

  void _showOrderSuccessBottomSheet(BuildContext context, String? orderId) {
    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusBottomSheet),
          ),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Success icon
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.success.withAlpha(25),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_circle,
                        size: 80,
                        color: AppColors.success,
                      ),
                    ),

                    const SizedBox(height: AppSpacing.lg),

                    // Title
                    Text(
                      'Đặt hàng thành công!',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),

                    const SizedBox(height: AppSpacing.sm),

                    // Message
                    Text(
                      'Cảm ơn bạn đã đặt hàng tại VNShop',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                      textAlign: TextAlign.center,
                    ),

                    if (orderId != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: AppSpacing.sm,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          borderRadius: BorderRadius.circular(AppSpacing.radiusSmall),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Mã đơn hàng: ',
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              orderId,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: AppSpacing.xl),

                    // Info card
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.info.withAlpha(25),
                        borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
                        border: Border.all(
                          color: AppColors.info.withAlpha(77),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.info_outline,
                            color: AppColors.info,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              'Bạn sẽ nhận được email xác nhận đơn hàng trong giây lát',
                              style: TextStyle(
                                color: AppColors.info,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const Spacer(),

                    // Buttons
                    Row(
                      children: [
                        Expanded(
                          child: VnSecondaryButton(
                            onPressed: () {
                              Navigator.of(sheetContext).pop();
                              context.go('/orders');
                            },
                            label: 'Xem đơn hàng',
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: VnPrimaryButton(
                            onPressed: () {
                              Navigator.of(sheetContext).pop();
                              context.read<CartBloc>().add(const CartCleared());
                              context.read<CheckoutBloc>().add(const CheckoutReset());
                              context.go('/');
                            },
                            label: 'Tiếp tục mua sắm',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Step indicator widget
class _StepIndicator extends StatelessWidget {
  final int currentStep;

  const _StepIndicator({required this.currentStep});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      color: AppColors.surface,
      child: Row(
        children: List.generate(4, (index) {
          final isCompleted = index < currentStep;
          final isCurrent = index == currentStep;

          return Expanded(
            child: Row(
              children: [
                // Step circle
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isCompleted || isCurrent
                        ? AppColors.primary
                        : AppColors.outlineVariant,
                  ),
                  child: Center(
                    child: isCompleted
                        ? const Icon(
                            Icons.check,
                            size: 16,
                            color: AppColors.onPrimary,
                          )
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isCurrent
                                  ? AppColors.onPrimary
                                  : AppColors.onSurfaceVariant,
                            ),
                          ),
                  ),
                ),

                // Connecting line
                if (index < 3)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: isCompleted
                          ? AppColors.primary
                          : AppColors.outlineVariant,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

/// Address section widget
class _AddressSection extends StatelessWidget {
  final CheckoutState state;

  const _AddressSection({required this.state});

  @override
  Widget build(BuildContext context) {
    if (state.isLoadingAddresses) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (state.addresses.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Icon(
              Icons.location_off_outlined,
              size: 48,
              color: AppColors.outline,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Chưa có địa chỉ giao hàng',
              style: TextStyle(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.md),
            VnSecondaryButton(
              onPressed: () => context.push('/checkout/address/new'),
              label: 'Thêm địa chỉ mới',
              isFullWidth: false,
              height: 40,
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        ...state.addresses.map((address) => AddressCard(
              address: address,
              isSelected: state.selectedAddress?.id == address.id,
              onTap: () {
                context.read<CheckoutBloc>().add(CheckoutAddressSelected(address));
              },
              onEdit: () => context.push('/checkout/address/${address.id}'),
              onDelete: () => _showDeleteConfirmation(context, address),
            )),
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: TextButton.icon(
            onPressed: () => context.push('/checkout/address/new'),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Thêm địa chỉ mới'),
          ),
        ),
      ],
    );
  }

  void _showDeleteConfirmation(BuildContext context, VietnamAddress address) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xóa địa chỉ'),
        content: Text('Bạn có chắc muốn xóa địa chỉ của ${address.recipientName}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              // TODO: Add delete address event
              Navigator.pop(dialogContext);
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}

/// Shipping section widget
class _ShippingSection extends StatelessWidget {
  final CheckoutState state;

  const _ShippingSection({required this.state});

  @override
  Widget build(BuildContext context) {
    if (state.selectedAddress == null) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Text(
          'Vui lòng chọn địa chỉ giao hàng trước',
          style: TextStyle(color: AppColors.onSurfaceVariant),
        ),
      );
    }

    if (state.isLoadingShipping) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (state.shippingQuotes.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Icon(
              Icons.local_shipping_outlined,
              size: 48,
              color: AppColors.outline,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Không có phương thức vận chuyển khả dụng',
              style: TextStyle(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.md),
            VnSecondaryButton(
              onPressed: () {
                context.read<CheckoutBloc>().add(
                      CheckoutShippingQuotesRequested(state.selectedAddress!),
                    );
              },
              label: 'Tải lại',
              isFullWidth: false,
              height: 40,
            ),
          ],
        ),
      );
    }

    return Column(
      children: state.shippingQuotes.map((quote) {
        return ShippingMethodCard(
          shipping: quote,
          isSelected: state.selectedShipping?.id == quote.id,
          onTap: () {
            context.read<CheckoutBloc>().add(CheckoutShippingSelected(quote));
          },
        );
      }).toList(),
    );
  }
}

/// Payment section widget
class _PaymentSection extends StatelessWidget {
  final CheckoutState state;

  const _PaymentSection({required this.state});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        PaymentMethodCard(
          method: PaymentMethod.vnpay,
          isSelected: state.selectedPaymentMethod == PaymentMethod.vnpay,
          onTap: () => context
              .read<CheckoutBloc>()
              .add(CheckoutPaymentMethodSelected(PaymentMethod.vnpay)),
        ),
        PaymentMethodCard(
          method: PaymentMethod.momo,
          isSelected: state.selectedPaymentMethod == PaymentMethod.momo,
          onTap: () => context
              .read<CheckoutBloc>()
              .add(CheckoutPaymentMethodSelected(PaymentMethod.momo)),
        ),
        PaymentMethodCard(
          method: PaymentMethod.vietqr,
          isSelected: state.selectedPaymentMethod == PaymentMethod.vietqr,
          onTap: () => context
              .read<CheckoutBloc>()
              .add(CheckoutPaymentMethodSelected(PaymentMethod.vietqr)),
        ),
        PaymentMethodCard(
          method: PaymentMethod.cod,
          isSelected: state.selectedPaymentMethod == PaymentMethod.cod,
          onTap: () => context
              .read<CheckoutBloc>()
              .add(CheckoutPaymentMethodSelected(PaymentMethod.cod)),
        ),
      ],
    );
  }
}

/// Order summary section widget
class _OrderSummarySection extends StatelessWidget {
  final CheckoutState state;

  const _OrderSummarySection({required this.state});

  @override
  Widget build(BuildContext context) {
    final cartItems = context.read<CartBloc>().state.cart?.items ?? [];

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product list (collapsed by default)
          OrderSummarySheet(
            cartItems: cartItems,
            subtotal: state.subtotal,
            shippingFee: state.shippingFee,
            discountAmount: state.discountAmount,
            couponCode: state.session?.couponCode,
          ),
        ],
      ),
    );
  }
}
