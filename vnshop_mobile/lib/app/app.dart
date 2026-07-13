import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import '../l10n/generated/app_localizations.dart';

import '../core/auth/session_controller.dart';
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
import '../features/products/data/datasources/product_local_datasource.dart';
import '../features/products/data/datasources/product_remote_datasource.dart';
import '../features/products/data/repositories/product_repository_impl.dart';
import '../features/products/domain/repositories/product_repository.dart';
import '../features/checkout/data/repositories/checkout_repository_impl.dart';
import '../features/checkout/domain/repositories/checkout_repository.dart';
import 'router/app_router.dart';

class VnShopApp extends StatelessWidget {
  const VnShopApp({super.key, required this.sessionController});

  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    // Initialize order notification service
    OrderNotificationService.instance.initialize();

    // Initialize data sources (DioClient already initialized in main.dart)
    final authLocalDataSource = AuthLocalDataSourceImpl();
    final authRemoteDataSource = AuthRemoteDataSourceImpl();

    final authRepository = AuthRepositoryImpl(
      localDataSource: authLocalDataSource,
      remoteDataSource: authRemoteDataSource,
    );

    // P0b: Initialize repositories that routes depend on
    final productRepository = ProductRepositoryImpl(
      remoteDataSource: ProductRemoteDataSourceImpl(dio: DioClient.instance.dio),
      localDataSource: ProductLocalDataSourceImpl(),
    );
    final checkoutRepository = CheckoutRepositoryImpl(
      dio: DioClient.instance.dio,
    );

    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => AuthBloc(
            authRepository: authRepository,
            sessionController: sessionController,
          )
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
        // P0b: Provide repositories for routes
        Provider<ProductRepository>.value(value: productRepository),
        Provider<CheckoutRepository>.value(value: checkoutRepository),
      ],
      child: Builder(
        builder: (routerContext) {
          final router = buildAppRouter(routerContext);
          // Setup OneSignal deep linking after router is created
          setupOneSignalDeepLinking(router);
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
            routerConfig: router,
          );
        },
      ),
    );
  }
}
