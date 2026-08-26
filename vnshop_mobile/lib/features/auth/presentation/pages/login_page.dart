import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/generated/app_localizations.dart';

import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_event.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../widgets/password_input_field.dart';
import '../widgets/primary_button.dart';
import '../widgets/text_input_field.dart';

/// Login page with email/password authentication
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _rememberMe = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Validate email format
  String? _validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập email';
    }

    // Email regex pattern
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );

    if (!emailRegex.hasMatch(value)) {
      return 'Email không hợp lệ';
    }

    return null;
  }

  /// Validate password
  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu';
    }

    if (value.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    return null;
  }

  /// Handle login submission
  void _handleLogin() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            AuthLoginRequested(
              email: _emailController.text.trim(),
              password: _passwordController.text,
            ),
          );
    }
  }

  /// Handle forgot password
  void _handleForgotPassword() {
    _showForgotPasswordDialog();
  }

  /// Show forgot password dialog
  void _showForgotPasswordDialog() {
    final emailController = TextEditingController();
    final l10n = AppLocalizations.of(context);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.forgotPasswordTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l10n.forgotPasswordHelp),
            const SizedBox(height: 16),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                labelText: l10n.email,
                hintText: l10n.emailHint,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<AuthBloc>().add(
                    AuthForgotPasswordRequested(email: emailController.text.trim()),
                  );
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(l10n.resetEmailSent),
                ),
              );
            },
            child: Text(l10n.send),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final size = MediaQuery.of(context).size;
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          // Handle error messages
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage!),
                backgroundColor: theme.colorScheme.error,
              ),
            );
          }

          // Navigate to home on successful login
          if (state.isAuthenticated) {
            context.go('/');
          }
        },
        builder: (context, state) {
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo and title
                    SizedBox(height: size.height * 0.05),
                    Icon(
                      Icons.shopping_bag_outlined,
                      size: 80,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'VNShop',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.loginContinue,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),

                    const SizedBox(height: 48),

                    // Email field
                    TextInputField(
                      controller: _emailController,
                      labelText: 'Email',
                       hintText: l10n.emailHint,
                      prefixIcon: const Icon(Icons.email_outlined),
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      validator: _validateEmail,
                      enabled: !state.isLoading,
                      autofocus: true,
                    ),

                    const SizedBox(height: 16),

                    // Password field
                    PasswordInputField(
                      controller: _passwordController,
                       labelText: l10n.password,
                       hintText: l10n.passwordHintLogin,
                      prefixIcon: const Icon(Icons.lock_outlined),
                      validator: _validatePassword,
                      enabled: !state.isLoading,
                      onSubmitted: (_) => _handleLogin(),
                    ),

                    const SizedBox(height: 12),

                    // Remember me and forgot password
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Checkbox(
                              value: _rememberMe,
                              onChanged: state.isLoading
                                  ? null
                                  : (value) {
                                      setState(() {
                                        _rememberMe = value ?? false;
                                      });
                                    },
                            ),
                            Text(l10n.rememberLogin),
                          ],
                        ),
                        TextButton(
                          onPressed:
                              state.isLoading ? null : _handleForgotPassword,
                          child: Text(l10n.forgotPassword),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Login button
                    PrimaryButton(
                      onPressed: state.isLoading ? null : _handleLogin,
                      label: l10n.login,
                      isLoading: state.isLoading,
                      icon: const Icon(Icons.login),
                    ),

                    const SizedBox(height: 24),

                    // Register link
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${l10n.noAccount} ',
                          style: theme.textTheme.bodyMedium,
                        ),
                        TextButton(
                          onPressed: state.isLoading
                              ? null
                              : () => context.push('/register'),
                          child: Text(l10n.registerNow),
                        ),
                      ],
                    ),

                    const SizedBox(height: 32),

                    // Divider
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            l10n.or,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Social login buttons (placeholder)
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: state.isLoading
                                ? null
                                : () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(l10n.socialLoginUnavailable('Google')),
                                      ),
                                    );
                                  },
                            icon: const Icon(Icons.g_mobiledata, size: 24),
                            label: Text('Google'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: state.isLoading
                                ? null
                                : () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(l10n.socialLoginUnavailable('Facebook')),
                                      ),
                                    );
                                  },
                            icon: const Icon(Icons.facebook, size: 24),
                            label: Text('Facebook'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Validators utility class
class Validators {
  Validators._();

  /// Email validation regex
  static final RegExp _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  /// Validate email format
  static String? email(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập email';
    }
    if (!_emailRegex.hasMatch(value)) {
      return 'Email không hợp lệ';
    }
    return null;
  }

  /// Validate password (min 6 characters)
  static String? password(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu';
    }
    if (value.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    return null;
  }

  /// Validate Vietnamese phone number
  /// Supports: 0[1-9]\d{8} (e.g., 0912345678)
  /// and 84[1-9]\d{8} (e.g., 84123456789)
  static final RegExp _vietnamPhoneRegex = RegExp(
    r'^(0[1-9]\d{8}|84[1-9]\d{8})$',
  );

  /// Validate Vietnamese phone number
  static String? phone(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập số điện thoại';
    }
    // Normalize phone number (remove spaces, dashes)
    final normalized = value.replaceAll(RegExp(r'[\s-]'), '');
    if (!_vietnamPhoneRegex.hasMatch(normalized)) {
      return 'Số điện thoại không hợp lệ';
    }
    return null;
  }

  /// Validate required field
  static String? required(String? value, [String fieldName = 'Trường này']) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName không được để trống';
    }
    return null;
  }

  /// Validate full name
  static String? fullName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập họ tên';
    }
    if (value.trim().length < 2) {
      return 'Họ tên phải có ít nhất 2 ký tự';
    }
    if (value.trim().length > 100) {
      return 'Họ tên không được vượt quá 100 ký tự';
    }
    return null;
  }

  /// Validate password strength
  static String? passwordStrength(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu';
    }
    if (value.length < 8) {
      return 'Mật khẩu phải có ít nhất 8 ký tự';
    }
    if (!value.contains(RegExp(r'[A-Z]'))) {
      return 'Mật khẩu phải chứa ít nhất 1 chữ hoa';
    }
    if (!value.contains(RegExp(r'[a-z]'))) {
      return 'Mật khẩu phải chứa ít nhất 1 chữ thường';
    }
    if (!value.contains(RegExp(r'[0-9]'))) {
      return 'Mật khẩu phải chứa ít nhất 1 số';
    }
    return null;
  }

  /// Validate confirm password
  static String? confirmPassword(String? value, String password) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng xác nhận mật khẩu';
    }
    if (value != password) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  }
}
