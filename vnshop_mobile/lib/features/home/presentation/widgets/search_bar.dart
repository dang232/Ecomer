import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../l10n/generated/app_localizations.dart';

class HomeSearchBar extends StatefulWidget {
  const HomeSearchBar({
    required this.onSearch,
    required this.hintText,
    this.initialValue = '',
    super.key,
  });

  final ValueChanged<String> onSearch;
  final String hintText;
  final String initialValue;

  @override
  State<HomeSearchBar> createState() => _HomeSearchBarState();
}

class _HomeSearchBarState extends State<HomeSearchBar> {
  late final TextEditingController _controller;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
  }

  @override
  void didUpdateWidget(HomeSearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialValue != oldWidget.initialValue &&
        widget.initialValue != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.initialValue,
        selection: TextSelection.collapsed(offset: widget.initialValue.length),
      );
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged(String text) {
    setState(() {});
    _debounceTimer?.cancel();
    _debounceTimer = Timer(
      const Duration(milliseconds: 300),
      () => widget.onSearch(text.trim()),
    );
  }

  void _submit(String text) {
    _debounceTimer?.cancel();
    widget.onSearch(text.trim());
  }

  void _clear() {
    _debounceTimer?.cancel();
    _controller.clear();
    setState(() {});
    widget.onSearch('');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return TextField(
      controller: _controller,
      onChanged: _onTextChanged,
      onSubmitted: _submit,
      textInputAction: TextInputAction.search,
      maxLines: 1,
      decoration: InputDecoration(
        hintText: widget.hintText,
        filled: true,
        fillColor: colorScheme.surfaceContainerLow,
        prefixIcon: Icon(
          Icons.search,
          color: colorScheme.onSurfaceVariant,
        ),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: AppLocalizations.of(context).clearSearch,
                onPressed: _clear,
                icon: const Icon(Icons.close),
              ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        ),
      ),
    );
  }
}
