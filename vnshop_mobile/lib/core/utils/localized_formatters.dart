import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class LocalizedFormatters {
  const LocalizedFormatters._();

  static String currency(BuildContext context, num amount) {
    return NumberFormat.simpleCurrency(
      locale: Localizations.localeOf(context).toLanguageTag(),
      name: 'VND',
      decimalDigits: 0,
    ).format(amount);
  }

  static String dateTime(BuildContext context, DateTime value) {
    final localValue = value.toLocal();
    final material = MaterialLocalizations.of(context);
    final date = material.formatMediumDate(localValue);
    final time = material.formatTimeOfDay(TimeOfDay.fromDateTime(localValue));
    return '$date, $time';
  }
}
