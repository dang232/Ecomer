import '../../../../core/error/failures.dart';
import '../../data/models/token_set.dart';
import '../../data/models/user_model.dart';
import '../../presentation/bloc/auth_state.dart';

/// Repository interface for authentication operations
abstract class AuthRepository {
  /// Login with email and password
  /// Returns Either with Failure on error or UserModel on success
  Future<Either<Failure, UserModel>> login({
    required String email,
    required String password,
  });

  /// Register new user
  /// Returns Either with Failure on error or UserModel on success
  Future<Either<Failure, UserModel>> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  });

  /// Logout current user
  /// Returns Either with Failure on error or void on success
  Future<Either<Failure, void>> logout();

  /// Get current logged in user
  /// Returns Either with Failure on error or UserModel on success
  Future<Either<Failure, UserModel>> getCurrentUser();

  /// Get stored user (may be null if not logged in)
  Future<UserModel?> getStoredUser();

  /// Check if user is logged in
  Future<bool> isLoggedIn();

  /// Update user profile
  /// Returns Either with Failure on error or updated UserModel on success
  Future<Either<Failure, UserModel>> updateProfile({
    String? fullName,
    String? phone,
    String? address,
    DateTime? dateOfBirth,
    String? gender,
  });

  /// Change password
  /// Returns Either with Failure on error or void on success
  Future<Either<Failure, void>> changePassword({
    required String currentPassword,
    required String newPassword,
  });

  /// Forgot password - request reset email
  /// Returns Either with Failure on error or void on success
  Future<Either<Failure, void>> forgotPassword(String email);

  /// Reset password with token
  /// Returns Either with Failure on error or void on success
  Future<Either<Failure, void>> resetPassword({
    required String resetToken,
    required String newPassword,
  });

  /// Resend verification email
  /// Returns Either with Failure on error or void on success
  Future<Either<Failure, void>> resendVerificationEmail(String email);

  /// Refresh session/token
  /// Returns Either with Failure on error or TokenSet on success
  Future<Either<Failure, TokenSet>> refreshSession();

  /// Listen to auth state changes
  Stream<AuthState> get authStateChanges;
}

/// User login params
class LoginParams {
  const LoginParams({
    required this.email,
    required this.password,
  });

  final String email;
  final String password;

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
      };
}

/// User registration params
class RegisterParams {
  const RegisterParams({
    required this.email,
    required this.password,
    required this.fullName,
    this.phone,
  });

  final String email;
  final String password;
  final String fullName;
  final String? phone;

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
        'full_name': fullName,
        if (phone != null) 'phone': phone,
      };
}

/// Profile update params
class UpdateProfileParams {
  const UpdateProfileParams({
    this.fullName,
    this.phone,
    this.address,
    this.dateOfBirth,
    this.gender,
  });

  final String? fullName;
  final String? phone;
  final String? address;
  final DateTime? dateOfBirth;
  final String? gender;

  Map<String, dynamic> toJson() => {
        if (fullName != null) 'full_name': fullName,
        if (phone != null) 'phone': phone,
        if (address != null) 'address': address,
        if (dateOfBirth != null) 'date_of_birth': dateOfBirth!.toIso8601String(),
        if (gender != null) 'gender': gender,
      };
}
