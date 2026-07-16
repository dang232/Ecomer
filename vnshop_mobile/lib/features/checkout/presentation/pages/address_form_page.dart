import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/widgets/buttons/vn_button.dart';
import '../../../../common/widgets/inputs/vn_text_field.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../data/models/address_model.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import '../mappers/checkout_presentation_mapper.dart';

class AddressFormPage extends StatefulWidget {
  const AddressFormPage({super.key, this.addressId});

  final String? addressId;

  @override
  State<AddressFormPage> createState() => _AddressFormPageState();
}

class _AddressFormPageState extends State<AddressFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _streetController = TextEditingController();
  final _wardController = TextEditingController();
  final _districtController = TextEditingController();
  final _cityController = TextEditingController();

  VietnamAddress? _existingAddress;
  bool _isDefault = false;
  bool _isSubmitting = false;
  bool _sawAddressMutationStart = false;
  bool _addressNotFound = false;
  bool _isDirty = false;
  bool _allowPop = false;

  bool get isEditing => widget.addressId != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) _loadExistingAddress();
    for (final controller in _controllers) {
      controller.addListener(_markDirty);
    }
  }

  List<TextEditingController> get _controllers => [
    _streetController,
    _wardController,
    _districtController,
    _cityController,
  ];

  void _loadExistingAddress() {
    final addresses = context.read<CheckoutBloc>().state.addresses;
    for (final address in addresses) {
      if (address.id == widget.addressId) {
        _existingAddress = address;
        break;
      }
    }

    final address = _existingAddress;
    if (address == null) {
      _addressNotFound = true;
      return;
    }

    _streetController.text = address.streetAddress;
    _wardController.text = address.ward;
    _districtController.text = address.district;
    _cityController.text = address.city;
    _isDefault = address.isDefault;
  }

  void _markDirty() {
    if (_isDirty || !mounted) return;
    setState(() => _isDirty = true);
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller
        ..removeListener(_markDirty)
        ..dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return BlocListener<CheckoutBloc, CheckoutState>(
      listenWhen: (previous, current) =>
          previous.isLoadingAddresses != current.isLoadingAddresses ||
          previous.failure != current.failure,
      listener: _handleCheckoutState,
      child: PopScope(
        canPop: _allowPop || (!_isDirty && !_isSubmitting),
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _requestPop();
        },
        child: Scaffold(
          appBar: AppBar(
            title: Text(
              isEditing
                  ? localizations.editAddressTitle
                  : localizations.addNewAddress,
            ),
            leading: IconButton(
              tooltip: MaterialLocalizations.of(context).backButtonTooltip,
              onPressed: _isSubmitting ? null : _requestPop,
              icon: const Icon(Icons.arrow_back),
            ),
          ),
          body: _addressNotFound
              ? const _AddressNotFoundState()
              : AutofillGroup(
                  child: Form(
                    key: _formKey,
                    child: ListView(
                      padding: AppSpacing.responsivePadding(context),
                      children: [
                        Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 680),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  localizations.addressDetails,
                                  style: Theme.of(context).textTheme.titleLarge
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: AppSpacing.md),
                                VnTextField(
                                  controller: _streetController,
                                  labelText: localizations.streetAddressLabel,
                                  hintText: localizations.streetAddressHint,
                                  isRequired: true,
                                  prefixIcon: const Icon(Icons.home_outlined),
                                  keyboardType: TextInputType.streetAddress,
                                  textCapitalization: TextCapitalization.words,
                                  autofillHints: const [
                                    AutofillHints.streetAddressLine1,
                                  ],
                                  validator: (value) => _requiredField(
                                    value,
                                    localizations.streetAddressLabel,
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.md),
                                VnTextField(
                                  controller: _wardController,
                                  labelText: localizations.wardLabel,
                                  hintText: localizations.wardHint,
                                  prefixIcon: const Icon(
                                    Icons.location_city_outlined,
                                  ),
                                  textCapitalization: TextCapitalization.words,
                                ),
                                const SizedBox(height: AppSpacing.md),
                                VnTextField(
                                  controller: _districtController,
                                  labelText: localizations.districtLabel,
                                  hintText: localizations.districtHint,
                                  isRequired: true,
                                  prefixIcon: const Icon(Icons.map_outlined),
                                  textCapitalization: TextCapitalization.words,
                                  validator: (value) => _requiredField(
                                    value,
                                    localizations.districtLabel,
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.md),
                                VnTextField(
                                  controller: _cityController,
                                  labelText: localizations.cityProvinceLabel,
                                  hintText: localizations.cityProvinceHint,
                                  isRequired: true,
                                  prefixIcon: const Icon(Icons.public_outlined),
                                  textCapitalization: TextCapitalization.words,
                                  textInputAction: TextInputAction.done,
                                  autofillHints: const [
                                    AutofillHints.addressState,
                                  ],
                                  validator: (value) => _requiredField(
                                    value,
                                    localizations.cityProvinceLabel,
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                Material(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.surfaceContainerLow,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: AppSpacing.borderRadiusSmall,
                                    side: BorderSide(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.outlineVariant,
                                    ),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: CheckboxListTile(
                                    value: _isDefault,
                                    onChanged: _isSubmitting
                                        ? null
                                        : (value) {
                                            setState(() {
                                              _isDefault = value ?? false;
                                              _isDirty = true;
                                            });
                                          },
                                    title: Text(
                                      localizations.setDefaultAddress,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    subtitle: Text(
                                      localizations.defaultAddressHelp,
                                    ),
                                    controlAffinity:
                                        ListTileControlAffinity.leading,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.sm,
                                      vertical: AppSpacing.xs,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xl),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
          bottomNavigationBar: _addressNotFound
              ? null
              : Material(
                  color: Theme.of(context).colorScheme.surface,
                  child: SafeArea(
                    top: false,
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        border: Border(
                          top: BorderSide(
                            color: Theme.of(context).colorScheme.outlineVariant,
                          ),
                        ),
                      ),
                      child: VnPrimaryButton(
                        onPressed: _isSubmitting ? null : _saveAddress,
                        label: localizations.saveAddress,
                        isLoading: _isSubmitting,
                      ),
                    ),
                  ),
                ),
        ),
      ),
    );
  }

  String? _requiredField(String? value, String label) {
    if (value == null || value.trim().isEmpty) {
      return AppLocalizations.of(context).requiredField(label);
    }
    return null;
  }

  void _saveAddress() {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final checkoutState = context.read<CheckoutBloc>().state;
    final profileAddress =
        _existingAddress ??
        (checkoutState.addresses.isEmpty
            ? null
            : checkoutState.addresses.first);
    final address = VietnamAddress(
      id: widget.addressId ?? '',
      recipientName: profileAddress?.recipientName ?? '',
      phoneNumber: profileAddress?.phoneNumber ?? '',
      streetAddress: _streetController.text.trim(),
      ward: _wardController.text.trim(),
      district: _districtController.text.trim(),
      city: _cityController.text.trim(),
      isDefault: _isDefault,
    );

    setState(() {
      _isSubmitting = true;
      _sawAddressMutationStart = false;
    });
    context.read<CheckoutBloc>().add(
      isEditing
          ? CheckoutAddressUpdated(address)
          : CheckoutAddressAdded(address),
    );
  }

  void _handleCheckoutState(BuildContext context, CheckoutState state) {
    if (!_isSubmitting) return;
    if (state.isLoadingAddresses) {
      _sawAddressMutationStart = true;
      return;
    }
    if (!_sawAddressMutationStart) return;

    final failure = state.failure;
    if (failure == CheckoutFailure.addAddress ||
        failure == CheckoutFailure.updateAddress) {
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            failure!.localizedMessage(AppLocalizations.of(context)),
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      context.read<CheckoutBloc>().add(const CheckoutFailureDismissed());
      return;
    }

    final localizations = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isEditing
              ? localizations.addressUpdatedSuccess
              : localizations.addressAddedSuccess,
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
    setState(() {
      _isSubmitting = false;
      _allowPop = true;
      _isDirty = false;
    });
    context.pop();
  }

  Future<void> _requestPop() async {
    if (_isSubmitting) return;
    if (!_isDirty) {
      context.pop();
      return;
    }

    final localizations = AppLocalizations.of(context);
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(localizations.discardAddressTitle),
        content: Text(localizations.discardAddressHelp),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(localizations.cancel),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(localizations.discardChanges),
          ),
        ],
      ),
    );

    if (discard == true && mounted) {
      setState(() => _allowPop = true);
      context.pop();
    }
  }
}

class _AddressNotFoundState extends StatelessWidget {
  const _AddressNotFoundState();

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.location_off_outlined,
                size: 56,
                color: colors.onSurfaceVariant,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                localizations.addressNotFoundTitle,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                localizations.addressNotFoundHelp,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: AppSpacing.lg),
              OutlinedButton.icon(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back),
                label: Text(localizations.checkout),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
