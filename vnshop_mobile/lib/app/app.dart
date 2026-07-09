import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import '../l10n/generated/app_localizations.dart';

import '../core/theme/app_theme.dart';
import '../core/notifications/order_notification_service.dart';
import '../core/network/dio_client.dart';
import '../features/auth/data/datasources/auth_local_datasource.dart';
import '../features/auth/data/datasources/auth_remote_datasource.dart';
import '../features/auth/data/repositories/auth_repository_impl.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/auth/presentation/bloc/auth_event.dart';
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

    // Setup OneSignal deep linking
    setupOneSignalDeepLinking(appRouter);

    // ponytail: AuthRepositoryImpl uses DioClient.instance which needs init first
    final authLocalDataSource = AuthLocalDataSourceImpl();
    final authRemoteDataSource = AuthRemoteDataSourceImpl();
    final authRepository = AuthRepositoryImpl(
      localDataSource: authLocalDataSource,
      remoteDataSource: authRemoteDataSource,
    );

    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => AuthBloc(authRepository: authRepository)
            ..add(AuthCheckRequested()),
        ),
        BlocProvider<CartBloc>(
          create: (_) => CartBloc(
            repository: CartRepositoryImpl(
              localDataSource: CartLocalDataSourceImpl(),
              remoteDataSource: CartRemoteDataSourceImpl(dio: DioClient.instance.dio),
            ),
          ),
        ),
      ],
      child: MaterialApp.router(
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
      ),
    );
  }
}
