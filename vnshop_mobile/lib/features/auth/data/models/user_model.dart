import 'dart:convert';

import 'package:equatable/equatable.dart';

/// User model representing authenticated user data
class UserModel extends Equatable {
  const UserModel({
    required this.id,
    required this.email,
    this.fullName,
    this.phone,
    this.avatarUrl,
    this.address,
    this.dateOfBirth,
    this.gender,
    this.isEmailVerified = false,
    this.isPhoneVerified = false,
    this.role = UserRole.customer,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String email;
  final String? fullName;
  final String? phone;
  final String? avatarUrl;
  final String? address;
  final DateTime? dateOfBirth;
  final Gender? gender;
  final bool isEmailVerified;
  final bool isPhoneVerified;
  final UserRole role;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Create from JSON
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['full_name'] as String?,
      phone: json['phone'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      address: json['address'] as String?,
      dateOfBirth: json['date_of_birth'] != null
          ? DateTime.tryParse(json['date_of_birth'] as String)
          : null,
      gender: json['gender'] != null
          ? Gender.fromString(json['gender'] as String)
          : null,
      isEmailVerified: json['is_email_verified'] as bool? ?? false,
      isPhoneVerified: json['is_phone_verified'] as bool? ?? false,
      role: json['role'] != null
          ? UserRole.fromString(json['role'] as String)
          : UserRole.customer,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
    );
  }

  /// Create from JSON string
  factory UserModel.fromJsonString(String jsonString) {
    return UserModel.fromJson(json.decode(jsonString) as Map<String, dynamic>);
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': fullName,
      'phone': phone,
      'avatar_url': avatarUrl,
      'address': address,
      'date_of_birth': dateOfBirth?.toIso8601String(),
      'gender': gender?.value,
      'is_email_verified': isEmailVerified,
      'is_phone_verified': isPhoneVerified,
      'role': role.value,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  /// Convert to JSON string
  String toJsonString() => json.encode(toJson());

  /// Create a copy with updated fields
  UserModel copyWith({
    String? id,
    String? email,
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? address,
    DateTime? dateOfBirth,
    Gender? gender,
    bool? isEmailVerified,
    bool? isPhoneVerified,
    UserRole? role,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      address: address ?? this.address,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      gender: gender ?? this.gender,
      isEmailVerified: isEmailVerified ?? this.isEmailVerified,
      isPhoneVerified: isPhoneVerified ?? this.isPhoneVerified,
      role: role ?? this.role,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Get display name (full name or email)
  String get displayName => fullName ?? email.split('@').first;

  /// Check if user is admin
  bool get isAdmin => role == UserRole.admin;

  /// Check if user is customer
  bool get isCustomer => role == UserRole.customer;

  /// Check if user has verified email
  bool get isVerified => isEmailVerified && isPhoneVerified;

  @override
  List<Object?> get props => [
        id,
        email,
        fullName,
        phone,
        avatarUrl,
        address,
        dateOfBirth,
        gender,
        isEmailVerified,
        isPhoneVerified,
        role,
        createdAt,
        updatedAt,
      ];
}

/// User role enum
enum UserRole {
  customer('customer'),
  admin('admin'),
  staff('staff');

  const UserRole(this.value);

  final String value;

  static UserRole fromString(String value) {
    return UserRole.values.firstWhere(
      (role) => role.value == value.toLowerCase(),
      orElse: () => UserRole.customer,
    );
  }
}

/// Gender enum
enum Gender {
  male('male'),
  female('female'),
  other('other');

  const Gender(this.value);

  final String value;

  static Gender? fromString(String? value) {
    if (value == null) return null;
    return Gender.values.firstWhere(
      (g) => g.value == value.toLowerCase(),
      orElse: () => Gender.other,
    );
  }
}
