import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../cart/presentation/bloc/cart_bloc.dart';
import '../../../cart/presentation/bloc/cart_event.dart';
import '../../../cart/presentation/mappers/product_cart_item_mapper.dart';
import '../../../reviews/presentation/bloc/review_cubit.dart';
import '../../../reviews/presentation/bloc/review_state.dart';
import '../../../reviews/presentation/widgets/product_reviews_section.dart';
import '../../../wishlist/presentation/widgets/wishlist_button.dart';
import '../../data/models/product_model.dart';

/// Complete product detail page with all features:
/// - Image carousel with dots indicator
/// - Product info (name, price, rating, review count)
/// - Quantity selector
/// - Expandable description
/// - Product reviews with moderation feedback
/// - Sticky bottom bar with action buttons
class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({super.key, required this.product});

  final ProductModel product;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  int _quantity = 1;
  int _currentImageIndex = 0;
  bool _isDescriptionExpanded = false;

  final PageController _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  String get _loginLocation => Uri(
    path: AppRoutes.login,
    queryParameters: {'next': AppRoutes.productDetail(widget.product.id)},
  ).toString();

  void _incrementQuantity() {
    if (_quantity < widget.product.stock) {
      setState(() {
        _quantity++;
      });
    }
  }

  void _decrementQuantity() {
    if (_quantity > 1) {
      setState(() {
        _quantity--;
      });
    }
  }

  void _addSelectionToCart() {
    context.read<CartBloc>().add(
      CartItemAdded(
        mapProductToCartItem(product: widget.product, quantity: _quantity),
      ),
    );
  }

  void _addToCart() {
    if (widget.product.stock <= 0) return;

    _addSelectionToCart();
    final localizations = AppLocalizations.of(context);

    _showSnackBar(
      localizations.itemsAddedToCart(_quantity),
      icon: Icons.check_circle,
      action: SnackBarAction(
        label: localizations.viewCart,
        onPressed: () => context.push(AppRoutes.cart),
      ),
    );
  }

  void _buyNow() {
    if (widget.product.stock <= 0) return;

    _addSelectionToCart();
    context.push(AppRoutes.checkout);
  }

  void _showSnackBar(String message, {IconData? icon, SnackBarAction? action}) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 8),
            ],
            Expanded(child: Text(message)),
          ],
        ),
        action: action,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Future<void> _shareProduct() async {
    await Clipboard.setData(
      ClipboardData(text: AppRoutes.productDetail(widget.product.id)),
    );
    if (!mounted) return;
    _showSnackBar(
      AppLocalizations.of(context).productLinkCopied,
      icon: Icons.link,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final currencyFormat = NumberFormat.currency(
      locale: locale,
      symbol: '₫',
      decimalDigits: 0,
    );
    final reviewState = context.watch<ReviewCubit>().state;
    final hasLiveReviews =
        reviewState.status == ReviewViewStatus.ready ||
        reviewState.status == ReviewViewStatus.empty;
    final reviewRating = hasLiveReviews
        ? reviewState.summary.average
        : widget.product.rating;
    final reviewCount = hasLiveReviews
        ? reviewState.summary.count
        : widget.product.reviewCount;
    final isAuthenticated = context.watch<AuthBloc>().state.isAuthenticated;
    final allImages = [
      widget.product.imageUrl,
      ...widget.product.images.where((img) => img != widget.product.imageUrl),
    ].where((img) => img.isNotEmpty).toList();
    final imageHeight = (MediaQuery.sizeOf(context).height * 0.42).clamp(
      280.0,
      420.0,
    );

    return Scaffold(
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // App bar with image carousel
          SliverAppBar(
            expandedHeight: imageHeight,
            pinned: true,
            stretch: true,
            leading: _buildBackButton(theme),
            actions: [_buildShareButton(theme), _buildFavoriteButton()],
            flexibleSpace: FlexibleSpaceBar(
              background: _buildImageCarousel(allImages),
            ),
          ),

          // Product info
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (widget.product.categoryName.trim().isNotEmpty) ...[
                    _buildCategoryBadge(theme),
                    const SizedBox(height: 12),
                  ],

                  // Product name
                  Text(
                    widget.product.name,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Price section
                  _buildPriceSection(theme, currencyFormat),
                  const SizedBox(height: 16),

                  // Rating and sold count
                  _buildRating(theme, reviewRating, reviewCount),
                  const Divider(height: 32),

                  // Stock status
                  _buildStockStatus(theme),
                  const Divider(height: 32),

                  // Description
                  _buildDescriptionSection(theme),
                  const Divider(height: 32),

                  ProductReviewsSection(
                    isAuthenticated: isAuthenticated,
                    onLogin: () => context.push(_loginLocation),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),

      bottomNavigationBar: _buildBottomBar(theme),
    );
  }

  Widget _buildBackButton(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.3),
          shape: BoxShape.circle,
        ),
        child: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
    );
  }

  Widget _buildShareButton(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.3),
          shape: BoxShape.circle,
        ),
        child: IconButton(
          icon: const Icon(Icons.share, color: Colors.white),
          tooltip: AppLocalizations.of(context).copyProductLink,
          onPressed: _shareProduct,
        ),
      ),
    );
  }

  Widget _buildFavoriteButton() {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: WishlistButton(
        productId: widget.product.id,
        returnLocation: AppRoutes.productDetail(widget.product.id),
        activeColor: Colors.red,
        inactiveColor: Colors.white,
        progressColor: Colors.white,
        backgroundColor: Colors.black.withValues(alpha: 0.3),
      ),
    );
  }

  Widget _buildImageCarousel(List<String> allImages) {
    return Stack(
      children: [
        // Image page view
        PageView.builder(
          controller: _pageController,
          itemCount: allImages.isEmpty ? 1 : allImages.length,
          onPageChanged: (index) {
            setState(() {
              _currentImageIndex = index;
            });
          },
          itemBuilder: (context, index) {
            if (allImages.isEmpty) {
              return Container(
                color: Colors.grey[200],
                child: Icon(
                  Icons.shopping_bag_outlined,
                  size: 80,
                  color: Colors.grey[400],
                ),
              );
            }
            return Image.network(
              allImages[index],
              fit: BoxFit.contain,
              semanticLabel: widget.product.name,
              errorBuilder: (context, error, stackTrace) => Container(
                color: Colors.grey[200],
                child: Icon(
                  Icons.image_not_supported_outlined,
                  size: 80,
                  color: Colors.grey[400],
                ),
              ),
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return Container(
                  color: Colors.grey[200],
                  child: Center(
                    child: CircularProgressIndicator(
                      value: loadingProgress.expectedTotalBytes != null
                          ? loadingProgress.cumulativeBytesLoaded /
                                loadingProgress.expectedTotalBytes!
                          : null,
                    ),
                  ),
                );
              },
            );
          },
        ),

        // Discount badge
        if (widget.product.hasDiscount)
          Positioned(
            top: 100,
            left: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '-${widget.product.discountPercentage!.toStringAsFixed(0)}%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),

        // Dots indicator
        if (allImages.length > 1)
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                allImages.length,
                (index) => AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: _currentImageIndex == index ? 24 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    color: _currentImageIndex == index
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.5),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCategoryBadge(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        widget.product.categoryName,
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onPrimaryContainer,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildPriceSection(ThemeData theme, NumberFormat currencyFormat) {
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: 12,
      runSpacing: 4,
      children: [
        Text(
          currencyFormat.format(widget.product.price),
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.error,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        if (widget.product.hasDiscount) ...[
          Text(
            currencyFormat.format(widget.product.originalPrice),
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.outline,
              decoration: TextDecoration.lineThrough,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildRating(ThemeData theme, double rating, int reviewCount) {
    final localizations = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 4,
        runSpacing: 4,
        children: [
          Icon(
            Icons.star_rounded,
            size: 18,
            color: theme.colorScheme.onTertiaryContainer,
          ),
          Text(
            rating.toStringAsFixed(1),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onTertiaryContainer,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            localizations.reviewCount(reviewCount),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onTertiaryContainer,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStockStatus(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    final inStock = widget.product.stock > 0;
    final isLowStock = widget.product.stock > 0 && widget.product.stock <= 10;

    return Row(
      children: [
        Icon(
          inStock ? Icons.check_circle : Icons.cancel,
          size: 20,
          color: inStock
              ? (isLowStock ? Colors.orange : Colors.green)
              : theme.colorScheme.error,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            inStock
                ? (isLowStock
                      ? localizations.lowStock(widget.product.stock)
                      : localizations.inStock)
                : localizations.outOfStock,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: inStock
                  ? (isLowStock ? Colors.orange : Colors.green)
                  : theme.colorScheme.error,
              fontWeight: isLowStock ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDescriptionSection(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                localizations.productDescription,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            IconButton(
              tooltip: _isDescriptionExpanded
                  ? localizations.collapseDescription
                  : localizations.expandDescription,
              icon: AnimatedRotation(
                turns: _isDescriptionExpanded ? 0.5 : 0,
                duration: const Duration(milliseconds: 200),
                child: const Icon(Icons.keyboard_arrow_down),
              ),
              onPressed: () {
                setState(() {
                  _isDescriptionExpanded = !_isDescriptionExpanded;
                });
              },
            ),
          ],
        ),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState: _isDescriptionExpanded
              ? CrossFadeState.showFirst
              : CrossFadeState.showSecond,
          firstChild: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              widget.product.description.isNotEmpty
                  ? widget.product.description
                  : localizations.noProductDescription,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.6,
              ),
            ),
          ),
          secondChild: const SizedBox.shrink(),
        ),
        if (!_isDescriptionExpanded)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              widget.product.description.isNotEmpty
                  ? (widget.product.description.length > 100
                        ? '${widget.product.description.substring(0, 100)}...'
                        : widget.product.description)
                  : localizations.noProductDescription,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.6,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildBottomBar(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    final isOutOfStock = widget.product.stock <= 0;

    return Material(
      color: theme.colorScheme.surface,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(color: theme.colorScheme.outlineVariant),
          ),
        ),
        child: SafeArea(
          top: false,
          child: isOutOfStock
              ? SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.inventory_2_outlined),
                    label: Text(localizations.outOfStock),
                    style: _purchaseButtonStyle(),
                  ),
                )
              : LayoutBuilder(
                  builder: (context, constraints) {
                    final largeText =
                        MediaQuery.textScalerOf(context).scale(14) > 20;
                    final actions = _buildPurchaseButtons(
                      localizations,
                      stack: largeText,
                    );
                    final quantity = Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        Text(
                          localizations.quantity,
                          style: theme.textTheme.labelLarge,
                        ),
                        _buildCompactQuantitySelector(theme),
                      ],
                    );

                    if (constraints.maxWidth < 600) {
                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          quantity,
                          const SizedBox(height: 12),
                          actions,
                        ],
                      );
                    }

                    return Row(
                      children: [
                        quantity,
                        const SizedBox(width: 16),
                        Expanded(child: actions),
                      ],
                    );
                  },
                ),
        ),
      ),
    );
  }

  Widget _buildPurchaseButtons(
    AppLocalizations localizations, {
    required bool stack,
  }) {
    final addButton = FilledButton.tonalIcon(
      onPressed: _addToCart,
      icon: const Icon(Icons.add_shopping_cart_outlined),
      label: Text(localizations.addToCart, textAlign: TextAlign.center),
      style: _purchaseButtonStyle(),
    );
    final buyButton = FilledButton.icon(
      onPressed: _buyNow,
      icon: const Icon(Icons.bolt_outlined),
      label: Text(localizations.buyNow, textAlign: TextAlign.center),
      style: _purchaseButtonStyle(),
    );

    if (stack) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [addButton, const SizedBox(height: 8), buyButton],
      );
    }

    return Row(
      children: [
        Expanded(child: addButton),
        const SizedBox(width: 12),
        Expanded(child: buyButton),
      ],
    );
  }

  ButtonStyle _purchaseButtonStyle() {
    return FilledButton.styleFrom(
      minimumSize: const Size(0, 48),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }

  Widget _buildCompactQuantitySelector(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outline),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.remove, size: 18),
            tooltip: localizations.decreaseQuantity,
            onPressed: _quantity > 1 ? _decrementQuantity : null,
            iconSize: 20,
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
          Semantics(
            label: localizations.quantityValue(_quantity),
            liveRegion: true,
            child: Container(
              constraints: const BoxConstraints(minWidth: 32),
              child: Text(
                _quantity.toString(),
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add, size: 18),
            tooltip: localizations.increaseQuantity,
            onPressed: _quantity < widget.product.stock
                ? _incrementQuantity
                : null,
            iconSize: 20,
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
        ],
      ),
    );
  }
}
