import 'package:flutter/material.dart';
import 'package:rxdart/rxdart.dart';

class ProductSearchBar extends StatefulWidget {
  final ValueChanged<String> onSearch;
  final VoidCallback? onClear;
  final String? initialValue;
  final String hintText;

  const ProductSearchBar({
    super.key,
    required this.onSearch,
    this.onClear,
    this.initialValue,
    this.hintText = 'Tìm kiếm sản phẩm...',
  });

  @override
  State<ProductSearchBar> createState() => _ProductSearchBarState();
}

class _ProductSearchBarState extends State<ProductSearchBar> {
  late final TextEditingController _controller;
  late final BehaviorSubject<String> _searchSubject;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
    _searchSubject = BehaviorSubject<String>.seeded(widget.initialValue ?? '');
    
    _searchSubject
        .debounceTime(const Duration(milliseconds: 300))
        .distinct()
        .listen((query) {
      widget.onSearch(query);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _searchSubject.close();
    super.dispose();
  }

  void _onChanged(String value) {
    _searchSubject.add(value);
  }

  void _onClear() {
    _controller.clear();
    _searchSubject.add('');
    widget.onClear?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(24),
      ),
      child: TextField(
        controller: _controller,
        onChanged: _onChanged,
        decoration: InputDecoration(
          hintText: widget.hintText,
          hintStyle: TextStyle(color: Colors.grey[500]),
          prefixIcon: Icon(
            Icons.search,
            color: Colors.grey[600],
          ),
          suffixIcon: _controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: _onClear,
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
        ),
      ),
    );
  }
}
