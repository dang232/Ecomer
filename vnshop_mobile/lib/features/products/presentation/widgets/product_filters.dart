import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../domain/models/product_catalog_query.dart';

class ProductFiltersSheet extends StatefulWidget {
  const ProductFiltersSheet({
    required this.initialFilters,
    required this.onApply,
    super.key,
  });

  final ProductCatalogFilters initialFilters;
  final ValueChanged<ProductCatalogFilters> onApply;

  static Future<void> show(
    BuildContext context, {
    required ProductCatalogFilters initialFilters,
    required ValueChanged<ProductCatalogFilters> onApply,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) =>
          ProductFiltersSheet(initialFilters: initialFilters, onApply: onApply),
    );
  }

  @override
  State<ProductFiltersSheet> createState() => _ProductFiltersSheetState();
}

class _ProductFiltersSheetState extends State<ProductFiltersSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _minimumPriceController;
  late final TextEditingController _maximumPriceController;
  late bool _sameDayOnly;
  late bool _verifiedOnly;
  late bool _officialOnly;
  String? _rangeError;

  @override
  void initState() {
    super.initState();
    _minimumPriceController = TextEditingController(
      text: _formatInitialPrice(widget.initialFilters.minPrice),
    );
    _maximumPriceController = TextEditingController(
      text: _formatInitialPrice(widget.initialFilters.maxPrice),
    );
    _sameDayOnly = widget.initialFilters.sameDayOnly;
    _verifiedOnly = widget.initialFilters.verifiedOnly;
    _officialOnly = widget.initialFilters.officialOnly;
  }

  @override
  void dispose() {
    _minimumPriceController.dispose();
    _maximumPriceController.dispose();
    super.dispose();
  }

  String _formatInitialPrice(double? price) =>
      price == null ? '' : price.toStringAsFixed(0);

  double? _parsePrice(String value) =>
      value.trim().isEmpty ? null : double.tryParse(value.trim());

  String? _validatePrice(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final price = double.tryParse(value.trim());
    if (price == null || price < 0) {
      return AppLocalizations.of(context).invalidPrice;
    }
    return null;
  }

  void _reset() {
    setState(() {
      _minimumPriceController.clear();
      _maximumPriceController.clear();
      _sameDayOnly = false;
      _verifiedOnly = false;
      _officialOnly = false;
      _rangeError = null;
    });
  }

  void _apply() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final minimumPrice = _parsePrice(_minimumPriceController.text);
    final maximumPrice = _parsePrice(_maximumPriceController.text);
    if (minimumPrice != null &&
        maximumPrice != null &&
        minimumPrice > maximumPrice) {
      setState(() {
        _rangeError = AppLocalizations.of(context).invalidPriceRange;
      });
      return;
    }

    widget.onApply(
      ProductCatalogFilters(
        minPrice: minimumPrice,
        maxPrice: maximumPrice,
        sameDayOnly: _sameDayOnly,
        verifiedOnly: _verifiedOnly,
        officialOnly: _officialOnly,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: FractionallySizedBox(
        heightFactor: 0.86,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenPadding,
                0,
                AppSpacing.xs,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      localizations.filters,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: localizations.resetFilters,
                    onPressed: _reset,
                    icon: const Icon(Icons.restart_alt),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.screenPadding),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        key: const Key('min-price-field'),
                        controller: _minimumPriceController,
                        decoration: InputDecoration(
                          labelText: localizations.minimumPrice,
                          suffixText: 'VND',
                        ),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        validator: _validatePrice,
                        onChanged: (_) {
                          if (_rangeError != null) {
                            setState(() => _rangeError = null);
                          }
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        key: const Key('max-price-field'),
                        controller: _maximumPriceController,
                        decoration: InputDecoration(
                          labelText: localizations.maximumPrice,
                          suffixText: 'VND',
                        ),
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        validator: _validatePrice,
                        onChanged: (_) {
                          if (_rangeError != null) {
                            setState(() => _rangeError = null);
                          }
                        },
                      ),
                      if (_rangeError != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          _rangeError!,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.error,
                              ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.md),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(localizations.sameDayOnly),
                        value: _sameDayOnly,
                        onChanged: (value) =>
                            setState(() => _sameDayOnly = value),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(localizations.verifiedProductsOnly),
                        value: _verifiedOnly,
                        onChanged: (value) =>
                            setState(() => _verifiedOnly = value),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(localizations.officialStoresOnly),
                        value: _officialOnly,
                        onChanged: (value) =>
                            setState(() => _officialOnly = value),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FilledButton(
                    onPressed: _apply,
                    child: Text(localizations.applyFilters),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: Text(localizations.cancel),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
