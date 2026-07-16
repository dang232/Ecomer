import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/core/theme/app_theme.dart';
import 'package:vnshop_mobile/features/checkout/data/models/address_model.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:vnshop_mobile/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:vnshop_mobile/features/checkout/presentation/pages/address_form_page.dart';
import 'package:vnshop_mobile/l10n/generated/app_localizations.dart';

class MockCheckoutBloc extends MockBloc<CheckoutEvent, CheckoutState>
    implements CheckoutBloc {}

class FakeCheckoutEvent extends Fake implements CheckoutEvent {}

void main() {
  late MockCheckoutBloc checkoutBloc;

  const savedAddress = VietnamAddress(
    id: '0',
    recipientName: 'Buyer',
    phoneNumber: '+84900000000',
    streetAddress: '12 Coffee Road',
    ward: 'Ea Pok',
    district: "Cu M'gar",
    city: 'Dak Lak',
    isDefault: true,
  );

  setUpAll(() {
    registerFallbackValue(FakeCheckoutEvent());
  });

  setUp(() {
    checkoutBloc = MockCheckoutBloc();
  });

  tearDown(() async {
    await checkoutBloc.close();
  });

  Future<void> pumpForm(
    WidgetTester tester, {
    String? addressId,
    CheckoutState state = const CheckoutState(),
    double textScale = 1,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    when(() => checkoutBloc.state).thenReturn(state);

    await tester.pumpWidget(
      BlocProvider<CheckoutBloc>.value(
        value: checkoutBloc,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: AddressFormPage(addressId: addressId),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('edits any server address without a hardcoded location list', (
    tester,
  ) async {
    await pumpForm(
      tester,
      addressId: savedAddress.id,
      state: const CheckoutState(addresses: [savedAddress]),
      textScale: 2,
    );

    expect(find.text('Edit address'), findsOneWidget);
    expect(
      find.textContaining('City / Province', findRichText: true),
      findsOneWidget,
    );
    expect(find.text("Cu M'gar"), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('submits real address fields and waits for Bloc completion', (
    tester,
  ) async {
    await pumpForm(tester);

    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), '44 Market Street');
    await tester.enterText(fields.at(1), 'Ward 7');
    await tester.enterText(fields.at(2), 'District 3');
    await tester.enterText(fields.at(3), 'Ho Chi Minh City');
    await tester.tap(find.text('Save address'));
    await tester.pump();

    final captured = verify(() => checkoutBloc.add(captureAny())).captured;
    final event = captured.single as CheckoutAddressAdded;
    expect(event.address.streetAddress, '44 Market Street');
    expect(event.address.ward, 'Ward 7');
    expect(event.address.district, 'District 3');
    expect(event.address.city, 'Ho Chi Minh City');
    expect(find.text('Add new address'), findsOneWidget);
  });
}
