import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/session_controller.dart';
import '../core/localization/locale_controller.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/auth/presentation/bloc/auth_event.dart';
import '../features/auth/presentation/bloc/auth_state.dart';
import '../features/cart/presentation/bloc/cart_bloc.dart';
import '../features/wishlist/presentation/bloc/wishlist_cubit.dart';
import '../l10n/generated/app_localizations.dart';
import 'bootstrap/app_dependencies.dart';
import 'router/app_router.dart';

class VnShopApp extends StatelessWidget {
  const VnShopApp({
    required this.sessionController,
    required this.dependencies,
    super.key,
  });

  final SessionController sessionController;
  final AppDependencies dependencies;

  static final LocaleController localeController = LocaleController();

  @override
  Widget build(BuildContext context) {
    return AppDependenciesScope(
      dependencies: dependencies,
      child: MultiBlocProvider(
        providers: [
          BlocProvider<AuthBloc>(
            create: (_) => AuthBloc(
              authRepository: dependencies.authRepository,
              sessionController: sessionController,
            )..add(AuthCheckRequested()),
          ),
          BlocProvider<CartBloc>(
            create: (_) => CartBloc(repository: dependencies.cartRepository),
          ),
          BlocProvider<WishlistCubit>(
            create: (_) =>
                WishlistCubit(repository: dependencies.wishlistRepository),
          ),
        ],
        child: ListenableBuilder(
          listenable: localeController,
          builder: (context, child) => _AppView(locale: localeController.locale),
        ),
      ),
    );
  }
}

class _AppView extends StatefulWidget {
  const _AppView({required this.locale});

  final Locale locale;

  @override
  State<_AppView> createState() => _AppViewState();
}

class _AppViewState extends State<_AppView> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = buildAppRouter(context);
    setupOneSignalDeepLinking(_router);
  }

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (previous, current) => previous.status != current.status,
      listener: (context, state) {
        final wishlist = context.read<WishlistCubit>();
        if (state.isAuthenticated) {
          wishlist.load();
        } else if (state.status == AuthStatus.unauthenticated ||
            state.status == AuthStatus.expired) {
          wishlist.reset();
        }
      },
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
        supportedLocales: AppLocalizations.supportedLocales,
        locale: widget.locale,
        routerConfig: _router,
      ),
    );
  }
}
