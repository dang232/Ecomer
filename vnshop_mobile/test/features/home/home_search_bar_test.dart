import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/home/presentation/widgets/search_bar.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

void main() {
  testWidgets('debounces search and exposes a working clear action', (
    tester,
  ) async {
    final queries = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: HomeSearchBar(
            hintText: 'Search products…',
            onSearch: queries.add,
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'headphones');
    await tester.pump(const Duration(milliseconds: 299));

    expect(queries, isEmpty);
    expect(find.byTooltip('Clear search'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1));
    expect(queries, ['headphones']);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pump();

    expect(find.text('headphones'), findsNothing);
    expect(find.byTooltip('Clear search'), findsNothing);
    expect(queries, ['headphones', '']);
  });
}
