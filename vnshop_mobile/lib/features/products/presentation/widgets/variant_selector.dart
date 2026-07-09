import 'package:flutter/material.dart';

/// Variant selector for color and size options
/// Follows make-interfaces-feel-better principles
class VariantSelector extends StatelessWidget {
  const VariantSelector({
    super.key,
    required this.selectedColor,
    required this.colors,
    required this.onColorSelected,
    required this.selectedSize,
    required this.sizes,
    required this.onSizeSelected,
  });

  final String? selectedColor;
  final List<ColorOption> colors;
  final ValueChanged<String> onColorSelected;
  final String? selectedSize;
  final List<SizeOption> sizes;
  final ValueChanged<String> onSizeSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Color selector
        if (colors.isNotEmpty) ...[
          _ColorSelectorSection(
            colors: colors,
            selectedColor: selectedColor,
            onColorSelected: onColorSelected,
          ),
          const SizedBox(height: 16),
        ],

        // Size selector
        if (sizes.isNotEmpty) ...[
          _SizeSelectorSection(
            sizes: sizes,
            selectedSize: selectedSize,
            onSizeSelected: onSizeSelected,
          ),
        ],
      ],
    );
  }
}

class ColorOption {
  final String id;
  final String name;
  final Color color;

  const ColorOption({
    required this.id,
    required this.name,
    required this.color,
  });
}

class SizeOption {
  final String id;
  final String name;
  final bool isAvailable;

  const SizeOption({
    required this.id,
    required this.name,
    this.isAvailable = true,
  });
}

class _ColorSelectorSection extends StatelessWidget {
  const _ColorSelectorSection({
    required this.colors,
    required this.selectedColor,
    required this.onColorSelected,
  });

  final List<ColorOption> colors;
  final String? selectedColor;
  final ValueChanged<String> onColorSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Màu sắc',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: colors.map((colorOption) {
            final isSelected = selectedColor == colorOption.id;

            return _ColorButton(
              colorOption: colorOption,
              isSelected: isSelected,
              onTap: () => onColorSelected(colorOption.id),
            );
          }).toList(),
        ),
        if (selectedColor != null) ...[
          const SizedBox(height: 8),
          Text(
            'Đã chọn: ${colors.firstWhere((c) => c.id == selectedColor, orElse: () => colors.first).name}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _ColorButton extends StatefulWidget {
  const _ColorButton({
    required this.colorOption,
    required this.isSelected,
    required this.onTap,
  });

  final ColorOption colorOption;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  State<_ColorButton> createState() => _ColorButtonState();
}

class _ColorButtonState extends State<_ColorButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.9), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.0), weight: 50),
    ]).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onTap();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: widget.colorOption.color,
            shape: BoxShape.circle,
            border: Border.all(
              color: widget.isSelected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.outline.withValues(alpha: 0.3),
              width: widget.isSelected ? 3 : 1,
            ),
            boxShadow: widget.isSelected
                ? [
                    BoxShadow(
                      color: theme.colorScheme.primary.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: widget.isSelected
              ? Icon(
                  Icons.check,
                  size: 20,
                  color: _getContrastColor(widget.colorOption.color),
                )
              : null,
        ),
      ),
    );
  }

  Color _getContrastColor(Color color) {
    final luminance = color.computeLuminance();
    return luminance > 0.5 ? Colors.black : Colors.white;
  }
}

class _SizeSelectorSection extends StatelessWidget {
  const _SizeSelectorSection({
    required this.sizes,
    required this.selectedSize,
    required this.onSizeSelected,
  });

  final List<SizeOption> sizes;
  final String? selectedSize;
  final ValueChanged<String> onSizeSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Kích thước',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: sizes.map((sizeOption) {
            final isSelected = selectedSize == sizeOption.id;
            final isAvailable = sizeOption.isAvailable;

            return _SizeChip(
              sizeOption: sizeOption,
              isSelected: isSelected,
              onTap: isAvailable ? () => onSizeSelected(sizeOption.id) : null,
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _SizeChip extends StatefulWidget {
  const _SizeChip({
    required this.sizeOption,
    required this.isSelected,
    required this.onTap,
  });

  final SizeOption sizeOption;
  final bool isSelected;
  final VoidCallback? onTap;

  @override
  State<_SizeChip> createState() => _SizeChipState();
}

class _SizeChipState extends State<_SizeChip>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.95), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.95, end: 1.0), weight: 50),
    ]).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAvailable = widget.sizeOption.isAvailable;

    return GestureDetector(
      onTapDown: isAvailable && widget.onTap != null
          ? (_) => _controller.forward()
          : null,
      onTapUp: isAvailable && widget.onTap != null
          ? (_) {
              _controller.reverse();
              widget.onTap?.call();
            }
          : null,
      onTapCancel:
          isAvailable && widget.onTap != null ? () => _controller.reverse() : null,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: widget.isSelected
                ? theme.colorScheme.primary
                : isAvailable
                    ? theme.colorScheme.surface
                    : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: widget.isSelected
                  ? theme.colorScheme.primary
                  : isAvailable
                      ? theme.colorScheme.outline
                      : theme.colorScheme.outline.withValues(alpha: 0.3),
              width: widget.isSelected ? 2 : 1,
            ),
          ),
          child: Text(
            widget.sizeOption.name,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: widget.isSelected ? FontWeight.w600 : FontWeight.normal,
              color: widget.isSelected
                  ? theme.colorScheme.onPrimary
                  : isAvailable
                      ? theme.colorScheme.onSurface
                      : theme.colorScheme.outline,
              decoration: isAvailable ? null : TextDecoration.lineThrough,
            ),
          ),
        ),
      ),
    );
  }
}
