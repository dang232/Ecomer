import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../common/widgets/inputs/vn_text_field.dart';
import '../../data/models/address_model.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';

/// Page for adding or editing a delivery address
class AddressFormPage extends StatefulWidget {
  final String? addressId;

  const AddressFormPage({
    super.key,
    this.addressId,
  });

  @override
  State<AddressFormPage> createState() => _AddressFormPageState();
}

class _AddressFormPageState extends State<AddressFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _streetController = TextEditingController();

  // Province/City dropdown state
  String? _selectedProvince;
  String? _selectedDistrict;
  String? _selectedWard;

  bool _isDefault = false;
  bool _isLoading = false;

  // Mock data for Vietnam provinces
  final List<Map<String, dynamic>> _provinces = [
    {'id': 'hcm', 'name': 'TP. Hồ Chí Minh'},
    {'id': 'hn', 'name': 'TP. Hà Nội'},
    {'id': 'dn', 'name': 'TP. Đà Nẵng'},
    {'id': 'ct', 'name': 'TP. Cần Thơ'},
    {'id': 'hp', 'name': 'TP. Hải Phòng'},
    {'id': 'dn', 'name': 'TP. Đà Nẵng'},
  ];

  final List<Map<String, dynamic>> _districts = [
    {'id': 'q1', 'name': 'Quận 1'},
    {'id': 'q2', 'name': 'Quận 2'},
    {'id': 'q3', 'name': 'Quận 3'},
    {'id': 'q4', 'name': 'Quận 4'},
    {'id': 'q5', 'name': 'Quận 5'},
    {'id': 'q6', 'name': 'Quận 6'},
    {'id': 'q7', 'name': 'Quận 7'},
    {'id': 'q8', 'name': 'Quận 8'},
    {'id': 'bt', 'name': 'Quận Bình Thạnh'},
    {'id': 'gv', 'name': 'Quận Gò Vấp'},
    {'id': 'td', 'name': 'Quận Tân Bình'},
    {'id': 'ph', 'name': 'Quận Phú Nhuận'},
    {'id': 'tanbinh', 'name': 'Quận Tân Bình'},
    {'id': 'binhthanh', 'name': 'Quận Bình Thạnh'},
    {'id': 'go vap', 'name': 'Quận Gò Vấp'},
  ];

  final List<Map<String, dynamic>> _wards = [
    {'id': 'ph01', 'name': 'Phường 1'},
    {'id': 'ph02', 'name': 'Phường 2'},
    {'id': 'ph03', 'name': 'Phường 3'},
    {'id': 'ph04', 'name': 'Phường 4'},
    {'id': 'ph05', 'name': 'Phường 5'},
    {'id': 'ph06', 'name': 'Phường 6'},
    {'id': 'ph07', 'name': 'Phường 7'},
    {'id': 'ph08', 'name': 'Phường 8'},
    {'id': 'ph09', 'name': 'Phường 9'},
    {'id': 'ph10', 'name': 'Phường 10'},
    {'id': 'ph11', 'name': 'Phường 11'},
    {'id': 'ph12', 'name': 'Phường 12'},
    {'id': 'ph14', 'name': 'Phường 14'},
    {'id': 'ph15', 'name': 'Phường 15'},
  ];

  bool get isEditing => widget.addressId != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      _loadExistingAddress();
    }
  }

  void _loadExistingAddress() {
    final checkoutState = context.read<CheckoutBloc>().state;
    final address = checkoutState.addresses.firstWhere(
      (a) => a.id == widget.addressId,
      orElse: () => throw Exception('Address not found'),
    );

    _nameController.text = address.recipientName;
    _phoneController.text = address.phoneNumber;
    _streetController.text = address.streetAddress;
    _selectedProvince = address.city;
    _selectedDistrict = address.district;
    _selectedWard = address.ward;
    _isDefault = address.isDefault;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _streetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'),
        centerTitle: true,
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: BlocListener<CheckoutBloc, CheckoutState>(
        listener: (context, state) {
          if (state.status == CheckoutStatus.addressesLoaded && _isLoading) {
            setState(() => _isLoading = false);
            context.pop();
          }
        },
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              // Full name field
              VnTextField(
                controller: _nameController,
                labelText: 'Họ và tên',
                hintText: 'Nhập họ và tên người nhận',
                isRequired: true,
                prefixIcon: const Icon(Icons.person_outline),
                textCapitalization: TextCapitalization.words,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập họ tên';
                  }
                  return null;
                },
              ),

              const SizedBox(height: AppSpacing.md),

              // Phone field
              VnTextField(
                controller: _phoneController,
                labelText: 'Số điện thoại',
                hintText: 'Nhập số điện thoại',
                isRequired: true,
                prefixIcon: const Icon(Icons.phone_outlined),
                keyboardType: TextInputType.phone,
                maxLength: 10,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập số điện thoại';
                  }
                  if (value.length < 10) {
                    return 'Số điện thoại không hợp lệ';
                  }
                  return null;
                },
              ),

              const SizedBox(height: AppSpacing.md),

              // Street address field
              VnTextField(
                controller: _streetController,
                labelText: 'Địa chỉ (số nhà, tên đường)',
                hintText: 'Ví dụ: 123 Nguyễn Huệ, Phường Bến Nghé',
                isRequired: true,
                prefixIcon: const Icon(Icons.home_outlined),
                textCapitalization: TextCapitalization.words,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập địa chỉ';
                  }
                  return null;
                },
              ),

              const SizedBox(height: AppSpacing.lg),

              // Location dropdowns section
              Text(
                'Địa chỉ chi tiết',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),

              const SizedBox(height: AppSpacing.md),

              // Province/City dropdown
              _LocationDropdown(
                label: 'Tỉnh/Thành phố',
                value: _selectedProvince,
                items: _provinces,
                onChanged: (value) {
                  setState(() {
                    _selectedProvince = value;
                    _selectedDistrict = null;
                    _selectedWard = null;
                  });
                },
                isRequired: true,
              ),

              const SizedBox(height: AppSpacing.md),

              // District dropdown
              _LocationDropdown(
                label: 'Quận/Huyện',
                value: _selectedDistrict,
                items: _districts,
                onChanged: (value) {
                  setState(() {
                    _selectedDistrict = value;
                    _selectedWard = null;
                  });
                },
                isRequired: true,
              ),

              const SizedBox(height: AppSpacing.md),

              // Ward dropdown
              _LocationDropdown(
                label: 'Phường/Xã',
                value: _selectedWard,
                items: _wards,
                onChanged: (value) {
                  setState(() {
                    _selectedWard = value;
                  });
                },
                isRequired: true,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Default address checkbox
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerHigh.withAlpha(77),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
                ),
                child: CheckboxListTile(
                  value: _isDefault,
                  onChanged: (value) {
                    setState(() => _isDefault = value ?? false);
                  },
                  title: const Text(
                    'Đặt làm địa chỉ mặc định',
                    style: TextStyle(fontWeight: FontWeight.w500),
                  ),
                  subtitle: const Text(
                    'Địa chỉ này sẽ được sử dụng mặc định cho các đơn hàng tiếp theo',
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              // Save button
              VnPrimaryButton(
                onPressed: _isLoading ? null : _saveAddress,
                label: 'Lưu địa chỉ',
                isLoading: _isLoading,
              ),

              const SizedBox(height: AppSpacing.md),

              // Cancel button
              VnSecondaryButton(
                onPressed: () => context.pop(),
                label: 'Hủy',
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _saveAddress() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedProvince == null ||
        _selectedDistrict == null ||
        _selectedWard == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng chọn đầy đủ địa chỉ'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    // Find selected labels
    final provinceLabel = _provinces.firstWhere(
      (p) => p['id'] == _selectedProvince,
    )['name'] as String;
    final districtLabel = _districts.firstWhere(
      (d) => d['id'] == _selectedDistrict,
    )['name'] as String;
    final wardLabel = _wards.firstWhere(
      (w) => w['id'] == _selectedWard,
    )['name'] as String;

    final address = VietnamAddress(
      id: widget.addressId ?? 'new_${DateTime.now().millisecondsSinceEpoch}',
      recipientName: _nameController.text.trim(),
      phoneNumber: _phoneController.text.trim(),
      streetAddress: _streetController.text.trim(),
      ward: wardLabel,
      district: districtLabel,
      city: provinceLabel,
      isDefault: _isDefault,
    );

    if (isEditing) {
      context.read<CheckoutBloc>().add(CheckoutAddressUpdated(address));
      context.pop();
    } else {
      context.read<CheckoutBloc>().add(CheckoutAddressAdded(address));
      context.pop();
    }
  }
}

/// Location dropdown widget
class _LocationDropdown extends StatelessWidget {
  final String label;
  final String? value;
  final List<Map<String, dynamic>> items;
  final ValueChanged<String?> onChanged;
  final bool isRequired;

  const _LocationDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.isRequired = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                    color: AppColors.onSurface,
                  ),
            ),
            if (isRequired)
              Text(
                ' *',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.error,
                      fontWeight: FontWeight.w500,
                    ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: value,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.surfaceContainerHigh.withAlpha(77),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMedium),
              borderSide: const BorderSide(
                color: AppColors.primary,
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
          ),
          hint: Text(
            'Chọn $label',
            style: TextStyle(color: AppColors.onSurfaceVariant),
          ),
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down),
          items: items.map((item) {
            return DropdownMenuItem<String>(
              value: item['id'] as String,
              child: Text(
                item['name'] as String,
                overflow: TextOverflow.ellipsis,
              ),
            );
          }).toList(),
          onChanged: onChanged,
          validator: (value) {
            if (isRequired && value == null) {
              return 'Vui lòng chọn $label';
            }
            return null;
          },
        ),
      ],
    );
  }
}
