import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import '../l10n/generated/app_localizations.dart';

import '../core/theme/app_theme.dart';
import '../core/notifications/order_notification_service.dart';
import '../features/cart/data/datasources/cart_local_datasource.dart';
import '../features/cart/data/datasources/cart_remote_datasource.dart';
import '../features/cart/data/repositories/cart_repository_impl.dart';
import '../features/cart/presentation/bloc/cart_bloc.dart';
import 'router/app_router.dart';

class VnShopApp extends StatelessWidget {
  const VnShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Initialize order notification service
    OrderNotificationService.instance.initialize();

    // Setup FCM deep linking
    setupFcmDeepLinking(appRouter);

    return MaterialApp.router(
      title: 'VNShop',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('vi'),
        Locale('en'),
      ],
      locale: const Locale('vi'),
      routerConfig: appRouter,
      builder: (context, child) => BlocProvider<CartBloc>(
        // ponytail: deps default to Hive boxes + a fresh Dio; replace with DI
        // (RepositoryProvider) once auth and api base url land.
        create: (_) => CartBloc(
          repository: CartRepositoryImpl(
            localDataSource: CartLocalDataSourceImpl(),
            remoteDataSource: CartRemoteDataSourceImpl(dio: Dio()),
          ),
        ),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
