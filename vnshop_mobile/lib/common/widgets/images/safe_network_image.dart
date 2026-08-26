import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import '../../../core/utils/validators.dart';

class _ProductImageCache {
  static final instance = CacheManager(
    Config(
      'vnshop-images',
      stalePeriod: const Duration(days: 30),
      maxNrOfCacheObjects: 500,
    ),
  );
}

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
    this.semanticLabel,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Widget? placeholder;
  final Widget? errorWidget;
  final BorderRadius? borderRadius;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sanitizedUrl = Validators.sanitizeImageUrl(url);

    Widget imageWidget;

    if (sanitizedUrl == null) {
      imageWidget = _buildPlaceholder(theme);
    } else {
      imageWidget = CachedNetworkImage(
        imageUrl: sanitizedUrl,
        cacheManager: _ProductImageCache.instance,
        fit: fit,
        width: width,
        height: height,
        placeholder: (context, url) => _buildLoadingIndicator(theme),
        errorWidget: (context, url, error) =>
            errorWidget ?? _buildPlaceholder(theme),
      );
    }

    Widget result = borderRadius != null
        ? ClipRRect(
            borderRadius: borderRadius!,
            child: SizedBox(width: width, height: height, child: imageWidget),
          )
        : SizedBox(width: width, height: height, child: imageWidget);

    if (semanticLabel == null || semanticLabel!.isEmpty) return result;
    return Semantics(label: semanticLabel, image: true, child: result);
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
