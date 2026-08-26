import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/generated/app_localizations.dart';

import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';
import '../widgets/password_input_field.dart';
import '../widgets/primary_button.dart';
import '../widgets/text_input_field.dart';

/// Registration page with email/password authentication
class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _acceptTerms = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập email';
    }
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(value)) {
      return 'Email không hợp lệ';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu';
    }
    if (value.length < 8) {
      return 'Mật khẩu phải có ít nhất 8 ký tự';
    }
    if (!value.contains(RegExp(r'[A-Z]'))) {
      return 'Phải chứa ít nhất 1 chữ hoa';
    }
    if (!value.contains(RegExp(r'[a-z]'))) {
      return 'Phải chứa ít nhất 1 chữ thường';
    }
    if (!value.contains(RegExp(r'[0-9]'))) {
      return 'Phải chứa ít nhất 1 số';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng xác nhận mật khẩu';
    }
    if (value != _passwordController.text) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  }

  String? _validateFullName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập họ tên';
    }
    if (value.trim().length < 2) {
      return 'Họ tên phải có ít nhất 2 ký tự';
    }
    return null;
  }

  String? _validatePhone(String? value) {
    if (value == null || value.isEmpty) {
      return null; // Phone is optional
    }
    final phoneRegex = RegExp(r'^(0[1-9]\d{8}|84[1-9]\d{8})$');
    final normalized = value.replaceAll(RegExp(r'[\s-]'), '');
    if (!phoneRegex.hasMatch(normalized)) {
      return 'Số điện thoại không hợp lệ';
    }
    return null;
  }

  void _handleRegister() {
    if (!_acceptTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).agreeTermsRequired),
        ),
      );
      return;
    }

    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            AuthRegisterRequested(
              email: _emailController.text.trim(),
              password: _passwordController.text,
              fullName: _fullNameController.text.trim(),
              phone: _phoneController.text.trim().isEmpty
                  ? null
                  : _phoneController.text.trim(),
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.register),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage!),
                backgroundColor: theme.colorScheme.error,
              ),
            );
          }

          if (state.isAuthenticated) {
            context.go('/');
          }

          if (state.status == AuthStatus.needsVerification) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(l10n.registrationSuccess),
              ),
            );
            context.go('/login');
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
                    Text(
                      l10n.registerTitle,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l10n.registerSubtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Full name
                    TextInputField(
                      controller: _fullNameController,
                       labelText: l10n.fullName,
                       hintText: l10n.fullNameHint,
                      prefixIcon: const Icon(Icons.person_outlined),
                      textInputAction: TextInputAction.next,
                      validator: _validateFullName,
                      enabled: !state.isLoading,
                      textCapitalization: TextCapitalization.words,
                    ),

                    const SizedBox(height: 16),

                    // Email
                    TextInputField(
                      controller: _emailController,
                      labelText: 'Email',
                       hintText: l10n.emailHint,
                      prefixIcon: const Icon(Icons.email_outlined),
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      validator: _validateEmail,
                      enabled: !state.isLoading,
                    ),

                    const SizedBox(height: 16),

                    // Phone (optional)
                    TextInputField(
                      controller: _phoneController,
                       labelText: l10n.phoneOptional,
                       hintText: l10n.phoneHint,
                      prefixIcon: const Icon(Icons.phone_outlined),
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      validator: _validatePhone,
                      enabled: !state.isLoading,
                    ),

                    const SizedBox(height: 16),

                    // Password
                    PasswordInputField(
                      controller: _passwordController,
                      labelText: 'Mật khẩu',
                       hintText: l10n.createPassword,
                      prefixIcon: const Icon(Icons.lock_outlined),
                      validator: _validatePassword,
                      enabled: !state.isLoading,
                      textInputAction: TextInputAction.next,
                    ),

                    const SizedBox(height: 8),

                    // Password requirements hint
                    Text(
                      l10n.passwordRequirements,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Confirm password
                    PasswordInputField(
                      controller: _confirmPasswordController,
                       labelText: l10n.confirmPassword,
                       hintText: l10n.confirmPasswordHint,
                      prefixIcon: const Icon(Icons.lock_outlined),
                      validator: _validateConfirmPassword,
                      enabled: !state.isLoading,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _handleRegister(),
                    ),

                    const SizedBox(height: 16),

                    // Terms checkbox
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: _acceptTerms,
                          onChanged: state.isLoading
                              ? null
                              : (value) {
                                  setState(() {
                                    _acceptTerms = value ?? false;
                                  });
                                },
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: state.isLoading
                                ? null
                                : () {
                                    setState(() {
                                      _acceptTerms = !_acceptTerms;
                                    });
                                  },
                            child: Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: RichText(
                                text: TextSpan(
                                  style: theme.textTheme.bodyMedium,
                                  children: [
                                    TextSpan(text: l10n.agreeTermsPrefix),
                                    TextSpan(
                                       text: l10n.termsOfUse,
                                      style: TextStyle(
                                        color: theme.colorScheme.primary,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    TextSpan(text: l10n.privacyAnd),
                                    TextSpan(
                                       text: l10n.privacyPolicy,
                                      style: TextStyle(
                                        color: theme.colorScheme.primary,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Register button
                    PrimaryButton(
                      onPressed: state.isLoading ? null : _handleRegister,
                       label: l10n.register,
                      isLoading: state.isLoading,
                      icon: const Icon(Icons.person_add),
                    ),

                    const SizedBox(height: 24),

                    // Login link
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
                              : () => context.pop(),
                          child: Text(l10n.login),
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
