import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/order_model.dart';
import '../models/order_failure.dart';

extension OrderFailurePresentation on OrderFailure {
  String localizedMessage(AppLocalizations localizations) {
    return switch (this) {
      OrderFailure.network => localizations.orderNetworkError,
      OrderFailure.unauthorized => localizations.orderUnauthorizedError,
      OrderFailure.forbidden => localizations.orderForbiddenError,
      OrderFailure.notFound => localizations.orderNotFoundError,
      OrderFailure.server => localizations.orderServerError,
      OrderFailure.requestCancelled => localizations.orderRequestCancelledError,
      OrderFailure.unknown => localizations.orderUnknownError,
    };
  }
}

extension OrderStatusPresentation on OrderStatus {
  String localizedLabel(AppLocalizations localizations) {
    return switch (this) {
      OrderStatus.pending => localizations.orderStatusPending,
      OrderStatus.confirmed => localizations.orderStatusConfirmed,
      OrderStatus.processing => localizations.orderStatusProcessing,
      OrderStatus.shipped => localizations.orderStatusShipped,
      OrderStatus.delivered => localizations.orderStatusDelivered,
      OrderStatus.cancelled => localizations.orderStatusCancelled,
    };
  }

  IconData get icon {
    return switch (this) {
      OrderStatus.pending => Icons.schedule_outlined,
      OrderStatus.confirmed => Icons.inventory_2_outlined,
      OrderStatus.processing => Icons.inventory_2_outlined,
      OrderStatus.shipped => Icons.local_shipping_outlined,
      OrderStatus.delivered => Icons.check_circle_outline,
      OrderStatus.cancelled => Icons.cancel_outlined,
    };
  }

  Color get color {
    return switch (this) {
      OrderStatus.pending => AppColors.warning,
      OrderStatus.confirmed => AppColors.info,
      OrderStatus.processing => AppColors.info,
      OrderStatus.shipped => AppColors.primary,
      OrderStatus.delivered => AppColors.success,
      OrderStatus.cancelled => AppColors.error,
    };
  }

  int get progressIndex {
    return switch (this) {
      OrderStatus.pending => 0,
      OrderStatus.confirmed || OrderStatus.processing => 1,
      OrderStatus.shipped => 2,
      OrderStatus.delivered => 3,
      OrderStatus.cancelled => -1,
    };
  }
}

String localizedPaymentMethod(String? raw, AppLocalizations localizations) {
  return switch ((raw ?? '').trim().toUpperCase()) {
    'COD' => localizations.paymentCodName,
    'VIETQR' => localizations.paymentVietqrName,
    'VNPAY' => localizations.paymentVnpayName,
    'MOMO' => localizations.paymentMomoName,
    'BANK' || 'BANK_TRANSFER' => localizations.paymentBankTransferName,
    final value when value.isNotEmpty => value,
    _ => localizations.unpaid,
  };
}
