import 'package:flutter/material.dart';

/// Product filter options
class ProductFilterOptions {
  final double? minPrice;
  final double? maxPrice;
  final double? minRating;
  final List<String> selectedColors;
  final List<String> selectedSizes;
  final bool inStockOnly;

  const ProductFilterOptions({
    this.minPrice,
    this.maxPrice,
    this.minRating,
    this.selectedColors = const [],
    this.selectedSizes = const [],
    this.inStockOnly = false,
  });

  ProductFilterOptions copyWith({
    double? minPrice,
    double? maxPrice,
    double? minRating,
    List<String>? selectedColors,
    List<String>? selectedSizes,
    bool? inStockOnly,
  }) {
    return ProductFilterOptions(
      minPrice: minPrice ?? this.minPrice,
      maxPrice: maxPrice ?? this.maxPrice,
      minRating: minRating ?? this.minRating,
      selectedColors: selectedColors ?? this.selectedColors,
      selectedSizes: selectedSizes ?? this.selectedSizes,
      inStockOnly: inStockOnly ?? this.inStockOnly,
    );
  }

  bool get hasActiveFilters =>
      minPrice != null ||
      maxPrice != null ||
      minRating != null ||
      selectedColors.isNotEmpty ||
      selectedSizes.isNotEmpty ||
      inStockOnly;
}

/// Product filters bottom sheet
/// Provides filtering options for product listing
class ProductFiltersSheet extends StatefulWidget {
  const ProductFiltersSheet({
    super.key,
    this.initialFilters = const ProductFilterOptions(),
    required this.onApply,
  });

  final ProductFilterOptions initialFilters;
  final ValueChanged<ProductFilterOptions> onApply;

  static Future<void> show(
    BuildContext context, {
    ProductFilterOptions? initialFilters,
    required ValueChanged<ProductFilterOptions> onApply,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ProductFiltersSheet(
        initialFilters: initialFilters ?? const ProductFilterOptions(),
        onApply: onApply,
      ),
    );
  }

  @override
  State<ProductFiltersSheet> createState() => _ProductFiltersSheetState();
}

class _ProductFiltersSheetState extends State<ProductFiltersSheet> {
  late ProductFilterOptions _filters;

  // Price range bounds
  static const double _minPriceBound = 0;
  static const double _maxPriceBound = 100000000; // 100M VND

  // Available rating filters
  static const List<double> _ratingOptions = [4.5, 4.0, 3.5, 3.0];

  // Available colors
  static const List<Map<String, dynamic>> _colorOptions = [
    {'id': 'black', 'name': 'Đen', 'color': Colors.black},
    {'id': 'white', 'name': 'Trắng', 'color': Colors.white},
    {'id': 'red', 'name': 'Đỏ', 'color': Colors.red},
    {'id': 'blue', 'name': 'Xanh dương', 'color': Colors.blue},
    {'id': 'green', 'name': 'Xanh lá', 'color': Colors.green},
    {'id': 'yellow', 'name': 'Vàng', 'color': Colors.yellow},
    {'id': 'pink', 'name': 'Hồng', 'color': Colors.pink},
    {'id': 'purple', 'name': 'Tím', 'color': Colors.purple},
    {'id': 'orange', 'name': 'Cam', 'color': Colors.orange},
    {'id': 'gray', 'name': 'Xám', 'color': Colors.grey},
  ];

  // Available sizes
  static const List<Map<String, dynamic>> _sizeOptions = [
    {'id': 'xs', 'name': 'XS'},
    {'id': 's', 'name': 'S'},
    {'id': 'm', 'name': 'M'},
    {'id': 'l', 'name': 'L'},
    {'id': 'xl', 'name': 'XL'},
    {'id': 'xxl', 'name': 'XXL'},
  ];

  late RangeValues _priceRange;
  double? _selectedRating;
  List<String> _selectedColors = [];
  List<String> _selectedSizes = [];
  bool _inStockOnly = false;

  @override
  void initState() {
    super.initState();
    _filters = widget.initialFilters;
    _priceRange = RangeValues(
      _filters.minPrice ?? _minPriceBound,
      _filters.maxPrice ?? _maxPriceBound,
    );
    _selectedRating = _filters.minRating;
    _selectedColors = List.from(_filters.selectedColors);
    _selectedSizes = List.from(_filters.selectedSizes);
    _inStockOnly = _filters.inStockOnly;
  }

  void _resetFilters() {
    setState(() {
      _priceRange = RangeValues(_minPriceBound, _maxPriceBound);
      _selectedRating = null;
      _selectedColors = [];
      _selectedSizes = [];
      _inStockOnly = false;
    });
  }

  void _applyFilters() {
    final filters = ProductFilterOptions(
      minPrice: _priceRange.start > _minPriceBound ? _priceRange.start : null,
      maxPrice: _priceRange.end < _maxPriceBound ? _priceRange.end : null,
      minRating: _selectedRating,
      selectedColors: _selectedColors,
      selectedSizes: _selectedSizes,
      inStockOnly: _inStockOnly,
    );
    widget.onApply(filters);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outline.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Bộ lọc',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton(
                  onPressed: _resetFilters,
                  child: Text(
                    'Đặt lại',
                    style: TextStyle(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Filters content
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Price range
                  _buildSection(
                    title: 'Khoảng giá',
                    child: Column(
                      children: [
                        RangeSlider(
                          values: _priceRange,
                          min: _minPriceBound,
                          max: _maxPriceBound,
                          divisions: 100,
                          labels: RangeLabels(
                            _formatPrice(_priceRange.start),
                            _formatPrice(_priceRange.end),
                          ),
                          onChanged: (values) {
                            setState(() {
                              _priceRange = values;
                            });
                          },
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _formatPrice(_priceRange.start),
                                style: theme.textTheme.bodySmall,
                              ),
                              Text(
                                _formatPrice(_priceRange.end),
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Rating filter
                  _buildSection(
                    title: 'Đánh giá',
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _ratingOptions.map((rating) {
                        final isSelected = _selectedRating == rating;
                        return FilterChip(
                          label: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.star_rounded,
                                size: 16,
                                color: isSelected
                                    ? Colors.white
                                    : Colors.amber.shade600,
                              ),
                              const SizedBox(width: 4),
                              Text('${rating.toStringAsFixed(1)}+'),
                            ],
                          ),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              _selectedRating = selected ? rating : null;
                            });
                          },
                          selectedColor: theme.colorScheme.primary,
                          checkmarkColor: Colors.white,
                          labelStyle: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : theme.colorScheme.onSurface,
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Color filter
                  _buildSection(
                    title: 'Màu sắc',
                    child: Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: _colorOptions.map((colorOption) {
                        final isSelected = _selectedColors.contains(colorOption['id']);
                        return _ColorFilterButton(
                          color: colorOption['color'] as Color,
                          name: colorOption['name'] as String,
                          isSelected: isSelected,
                          onTap: () {
                            setState(() {
                              if (isSelected) {
                                _selectedColors.remove(colorOption['id']);
                              } else {
                                _selectedColors.add(colorOption['id'] as String);
                              }
                            });
                          },
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Size filter
                  _buildSection(
                    title: 'Kích thước',
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _sizeOptions.map((sizeOption) {
                        final isSelected = _selectedSizes.contains(sizeOption['id']);
                        return FilterChip(
                          label: Text(sizeOption['name'] as String),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              if (selected) {
                                _selectedSizes.add(sizeOption['id'] as String);
                              } else {
                                _selectedSizes.remove(sizeOption['id']);
                              }
                            });
                          },
                          selectedColor: theme.colorScheme.primary,
                          checkmarkColor: Colors.white,
                          labelStyle: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : theme.colorScheme.onSurface,
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Stock filter
                  _buildSection(
                    title: 'Tình trạng',
                    child: SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Chỉ hiển thị sản phẩm còn hàng'),
                      value: _inStockOnly,
                      onChanged: (value) {
                        setState(() {
                          _inStockOnly = value;
                        });
                      },
                      activeTrackColor: theme.colorScheme.primary,
                    ),
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),

          // Apply button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _applyFilters,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                  ),
                  child: const Text(
                    'Áp dụng',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({required String title, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        child,
      ],
    );
  }

  String _formatPrice(double price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(0)}M₫';
    } else if (price >= 1000) {
      return '${(price / 1000).toStringAsFixed(0)}K₫';
    }
    return '${price.toStringAsFixed(0)}₫';
  }
}

class _ColorFilterButton extends StatelessWidget {
  const _ColorFilterButton({
    required this.color,
    required this.name,
    required this.isSelected,
    required this.onTap,
  });

  final Color color;
  final String name;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outline.withValues(alpha: 0.3),
                width: isSelected ? 3 : 1,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: theme.colorScheme.primary.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: isSelected
                ? Icon(
                    Icons.check,
                    size: 18,
                    color: _getContrastColor(color),
                  )
                : null,
          ),
          const SizedBox(height: 4),
          Text(
            name,
            style: theme.textTheme.bodySmall?.copyWith(
              color: isSelected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Color _getContrastColor(Color color) {
    final luminance = color.computeLuminance();
    return luminance > 0.5 ? Colors.black : Colors.white;
  }
}
