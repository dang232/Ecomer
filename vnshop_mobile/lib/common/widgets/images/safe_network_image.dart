import 'package:flutter/material.dart';
import '../../../core/utils/validators.dart';

/// A safe network image widget that validates and sanitizes URLs before loading.
///
/// Features:
/// - Automatically fixes common URL issues (double dots, multiple slashes)
/// - Falls back to placeholder on error
/// - Shows loading indicator while fetching
class SafeNetworkImage extends StatelessWidget {
  const SafeNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.placeholder,
    this.errorWidget,
    this.borderRadius,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Widget? placeholder;
  final Widget? errorWidget;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sanitizedUrl = Validators.sanitizeImageUrl(url);

    Widget imageWidget;

    if (sanitizedUrl == null) {
      imageWidget = _buildPlaceholder(theme);
    } else {
      imageWidget = Image.network(
        sanitizedUrl,
        fit: fit,
        width: width,
        height: height,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return _buildLoadingIndicator(theme);
        },
        errorBuilder: (context, error, stackTrace) {
          debugPrint('SafeNetworkImage: Failed to load URL: $sanitizedUrl\nError: $error');
          return errorWidget ?? _buildPlaceholder(theme);
        },
      );
    }

    if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: SizedBox(
          width: width,
          height: height,
          child: imageWidget,
        ),
      );
    }

    return SizedBox(
      width: width,
      height: height,
      child: imageWidget,
    );
  }

  Widget _buildLoadingIndicator(ThemeData theme) {
    return Container(
      color: theme.colorScheme.surfaceContainerHighest,
      child: Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: theme.colorScheme.primary,
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholder(ThemeData theme) {
    return placeholder ??
        Container(
          width: width,
          height: height,
          color: theme.colorScheme.surfaceContainerHighest,
          child: Center(
            child: Icon(
              Icons.image_outlined,
              size: 32,
              color: theme.colorScheme.outline,
            ),
          ),
        );
  }
}
