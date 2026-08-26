import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/payment_transaction.dart';
import '../../data/models/shipping_quote.dart';
import '../bloc/checkout_state.dart';

extension CheckoutFailurePresentation on CheckoutFailure {
  String localizedMessage(AppLocalizations localizations) {
    return switch (this) {
      CheckoutFailure.initialize => localizations.checkoutInitializeError,
      CheckoutFailure.loadAddresses => localizations.checkoutAddressesLoadError,
      CheckoutFailure.addAddress => localizations.checkoutAddressAddError,
      CheckoutFailure.updateAddress => localizations.checkoutAddressUpdateError,
      CheckoutFailure.deleteAddress => localizations.checkoutAddressDeleteError,
      CheckoutFailure.loadShipping => localizations.shippingMethodsLoadError,
      CheckoutFailure.loadPaymentMethods =>
        localizations.paymentMethodsLoadError,
      CheckoutFailure.paymentMethodUnavailable =>
        localizations.checkoutPaymentUnavailable,
      CheckoutFailure.incomplete => localizations.checkoutIncompleteError,
      CheckoutFailure.updateSession => localizations.checkoutUpdateError,
      CheckoutFailure.initiatePayment =>
        localizations.checkoutPaymentStartError,
      CheckoutFailure.paymentStatus => localizations.checkoutPaymentStatusError,
      CheckoutFailure.paymentFailed => localizations.checkoutPaymentFailed,
      CheckoutFailure.transactionMissing =>
        localizations.checkoutTransactionMissing,
      CheckoutFailure.createOrder => localizations.checkoutOrderCreateError,
      CheckoutFailure.cancelOrder => localizations.checkoutOrderCancelError,
    };
  }
}

extension PaymentMethodPresentation on PaymentMethod {
  String localizedName(AppLocalizations localizations) {
    return switch (this) {
      PaymentMethod.cod => localizations.paymentCodName,
      PaymentMethod.vietqr => localizations.paymentVietqrName,
      PaymentMethod.sepay => 'SePay',
      PaymentMethod.vnpay => localizations.paymentVnpayName,
      PaymentMethod.momo => localizations.paymentMomoName,
      PaymentMethod.bankTransfer => localizations.paymentBankTransferName,
    };
  }

  String localizedDescription(AppLocalizations localizations) {
    return switch (this) {
      PaymentMethod.cod => localizations.paymentCodDescription,
      PaymentMethod.vietqr => localizations.paymentVietqrDescription,
      PaymentMethod.sepay => 'Chuyển khoản tự động và theo dõi trạng thái qua SePay',
      PaymentMethod.vnpay => localizations.paymentVnpayDescription,
      PaymentMethod.momo => localizations.paymentMomoDescription,
      PaymentMethod.bankTransfer =>
        localizations.paymentBankTransferDescription,
    };
  }

  IconData get icon {
    return switch (this) {
      PaymentMethod.cod => Icons.local_shipping_outlined,
      PaymentMethod.vietqr => Icons.qr_code_2,
      PaymentMethod.sepay => Icons.account_balance_outlined,
      PaymentMethod.vnpay => Icons.account_balance_outlined,
      PaymentMethod.momo => Icons.phone_android_outlined,
      PaymentMethod.bankTransfer => Icons.account_balance_wallet_outlined,
    };
  }

  Color get accentColor {
    return switch (this) {
      PaymentMethod.cod => AppColors.codOrange,
      PaymentMethod.vietqr => AppColors.vietqrBlue,
      PaymentMethod.sepay => AppColors.vietqrBlue,
      PaymentMethod.vnpay => AppColors.vnpayBlue,
      PaymentMethod.momo => AppColors.momoPink,
      PaymentMethod.bankTransfer => AppColors.bankGreen,
    };
  }
}

extension ShippingQuotePresentation on ShippingQuote {
  String localizedEstimate(AppLocalizations localizations) {
    return estimatedDays <= 0
        ? localizations.deliveryToday
        : localizations.deliveryDays(estimatedDays);
  }
}

extension ShippingProviderPresentation on ShippingProvider {
  IconData get icon {
    return switch (this) {
      ShippingProvider.giaoHangNhanh => Icons.local_shipping_outlined,
      ShippingProvider.giaoHangTietKiem => Icons.inventory_2_outlined,
      ShippingProvider.viettelPost => Icons.phone_android_outlined,
      ShippingProvider.vnPost => Icons.local_post_office_outlined,
      ShippingProvider.jAndTExpress => Icons.delivery_dining_outlined,
    };
  }
}
