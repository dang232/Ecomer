import 'package:equatable/equatable.dart';

class VietnamAddress extends Equatable {
  final String id;
  final String recipientName;
  final String phoneNumber;
  final String streetAddress;
  final String ward;
  final String district;
  final String city;
  final String? postalCode;
  final bool isDefault;

  const VietnamAddress({
    required this.id,
    required this.recipientName,
    required this.phoneNumber,
    required this.streetAddress,
    required this.ward,
    required this.district,
    required this.city,
    this.postalCode,
    this.isDefault = false,
  });

  String get fullAddress {
    return '$streetAddress, $ward, $district, $city';
  }

  String get shortAddress {
    return '$streetAddress, $ward, $district';
  }

  VietnamAddress copyWith({
    String? id,
    String? recipientName,
    String? phoneNumber,
    String? streetAddress,
    String? ward,
    String? district,
    String? city,
    String? postalCode,
    bool? isDefault,
  }) {
    return VietnamAddress(
      id: id ?? this.id,
      recipientName: recipientName ?? this.recipientName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      streetAddress: streetAddress ?? this.streetAddress,
      ward: ward ?? this.ward,
      district: district ?? this.district,
      city: city ?? this.city,
      postalCode: postalCode ?? this.postalCode,
      isDefault: isDefault ?? this.isDefault,
    );
  }

  factory VietnamAddress.fromJson(Map<String, dynamic> json) {
    return VietnamAddress(
      id: json['id'] as String? ?? '',
      recipientName: json['recipientName'] as String? ??
          json['recipient_name'] as String? ??
          '',
      phoneNumber: json['phoneNumber'] as String? ??
          json['phone_number'] as String? ??
          '',
      streetAddress: json['streetAddress'] as String? ??
          json['street_address'] as String? ??
          json['street'] as String? ??
          '',
      ward: json['ward'] as String? ?? '',
      district: json['district'] as String? ?? '',
      city: json['city'] as String? ?? '',
      postalCode: json['postalCode'] as String? ??
          json['postal_code'] as String?,
      isDefault: json['isDefault'] as bool? ??
          json['is_default'] as bool? ??
          false,
    );
  }

  factory VietnamAddress.fromBackendJson(
    Map<String, dynamic> json, {
    required int index,
    String? recipientName,
    String? phoneNumber,
  }) {
    return VietnamAddress(
      id: index.toString(),
      recipientName: recipientName ?? '',
      phoneNumber: phoneNumber ?? '',
      streetAddress: json['street'] as String? ?? '',
      ward: json['ward'] as String? ?? '',
      district: json['district'] as String? ?? '',
      city: json['city'] as String? ?? '',
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toBackendJson() {
    return {
      'street': streetAddress,
      'ward': ward,
      'district': district,
      'city': city,
      'isDefault': isDefault,
    };
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'recipientName': recipientName,
      'phoneNumber': phoneNumber,
      'streetAddress': streetAddress,
      'ward': ward,
      'district': district,
      'city': city,
      'postalCode': postalCode,
      'isDefault': isDefault,
    };
  }

  @override
  List<Object?> get props => [
        id,
        recipientName,
        phoneNumber,
        streetAddress,
        ward,
        district,
        city,
        postalCode,
        isDefault,
      ];
}
