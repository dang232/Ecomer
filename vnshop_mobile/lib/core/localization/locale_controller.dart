import 'package:flutter/material.dart';

class LocaleController extends ChangeNotifier {
  LocaleController({Locale initialLocale = const Locale('vi')})
      : _locale = initialLocale;

  Locale _locale;

  Locale get locale => _locale;

  void setLocale(Locale locale) {
    if (_locale == locale) return;
    _locale = locale;
    notifyListeners();
  }
}
