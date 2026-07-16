import 'package:flutter/material.dart';

class CategoryChips extends StatefulWidget {
  const CategoryChips({
    super.key,
    required this.categories,
    required this.selectedIndex,
    required this.onCategorySelected,
    this.scrollController,
  });

  final List<CategoryChipData> categories;
  final int selectedIndex;
  final ValueChanged<int> onCategorySelected;
  final ScrollController? scrollController;

  @override
  State<CategoryChips> createState() => _CategoryChipsState();
}

class _CategoryChipsState extends State<CategoryChips> {
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = widget.scrollController ?? ScrollController();
  }

  @override
  void dispose() {
    if (widget.scrollController == null) {
      _scrollController.dispose();
    }
    super.dispose();
  }

  void _scrollToSelected(int index) {
    if (!_scrollController.hasClients) return;

    // Estimate chip width (icon + text + padding)
    const estimatedChipWidth = 100.0;
    final targetOffset =
        (index * estimatedChipWidth) -
        (MediaQuery.of(context).size.width / 2) +
        (estimatedChipWidth / 2);

    final offset = targetOffset
        .clamp(0, _scrollController.position.maxScrollExtent)
        .toDouble();
    if (MediaQuery.disableAnimationsOf(context)) {
      _scrollController.jumpTo(offset);
    } else {
      _scrollController.animateTo(
        offset,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  void didUpdateWidget(CategoryChips oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.selectedIndex != oldWidget.selectedIndex) {
      _scrollToSelected(widget.selectedIndex);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
    final stripHeight = (48 + ((textScale - 1) * 20)).clamp(48, 80);
    return SizedBox(
      height: stripHeight.toDouble(),
      child: ListView.separated(
        controller: _scrollController,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: widget.categories.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = widget.categories[index];
          final isSelected = index == widget.selectedIndex;

          return Center(
            key: ValueKey(category.id),
            child: ChoiceChip(
              selected: isSelected,
              showCheckmark: false,
              avatar: category.icon == null ? null : Icon(category.icon),
              label: Text(
                category.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onSelected: (_) {
                widget.onCategorySelected(index);
                _scrollToSelected(index);
              },
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              materialTapTargetSize: MaterialTapTargetSize.padded,
            ),
          );
        },
      ),
    );
  }
}

class CategoryChipData {
  const CategoryChipData({
    required this.id,
    required this.name,
    this.icon,
    this.imageUrl,
  });

  final String id;
  final String name;
  final IconData? icon;
  final String? imageUrl;
}
