import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/models/product_model.dart';
import '../widgets/quantity_selector.dart';
import '../widgets/variant_selector.dart';
import '../widgets/product_grid_item.dart';

/// Complete product detail page with all features:
/// - Image carousel with dots indicator
/// - Product info (name, price, rating, sold count)
/// - Color/size variant selector
/// - Quantity selector
/// - Expandable description
/// - Similar products section
/// - Sticky bottom bar with action buttons
class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.product,
  });

  final ProductModel product;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage>
    with TickerProviderStateMixin {
  int _quantity = 1;
  int _currentImageIndex = 0;
  String? _selectedColor;
  String? _selectedSize;
  bool _isDescriptionExpanded = false;
  bool _isFavorite = false;
  bool _isAddingToCart = false;
  bool _isBuyingNow = false;

  final PageController _pageController = PageController();
  late AnimationController _favoriteAnimController;
  late Animation<double> _favoriteScaleAnimation;

  // Demo similar products
  final List<ProductModel> _similarProducts = [];

  // Demo colors and sizes (would come from product model in real app)
  final List<ColorOption> _availableColors = [
    const ColorOption(id: 'black', name: 'Đen', color: Colors.black),
    const ColorOption(id: 'white', name: 'Trắng', color: Colors.white),
    const ColorOption(id: 'red', name: 'Đỏ', color: Colors.red),
    const ColorOption(id: 'blue', name: 'Xanh dương', color: Colors.blue),
  ];

  final List<SizeOption> _availableSizes = [
    const SizeOption(id: 's', name: 'S'),
    const SizeOption(id: 'm', name: 'M', isAvailable: true),
    const SizeOption(id: 'l', name: 'L'),
    const SizeOption(id: 'xl', name: 'XL', isAvailable: false),
    const SizeOption(id: 'xxl', name: 'XXL'),
  ];

  @override
  void initState() {
    super.initState();
    _favoriteAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _favoriteScaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.2)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.2, end: 0.95)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.95, end: 1.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
    ]).animate(_favoriteAnimController);

    // Initialize demo similar products
    _initSimilarProducts();
  }

  void _initSimilarProducts() {
    _similarProducts.addAll([
      widget.product.copyWith(
        id: 'similar_1',
        name: '${widget.product.name} Pro',
        price: widget.product.price * 1.2,
      ),
      widget.product.copyWith(
        id: 'similar_2',
        name: '${widget.product.name} Lite',
        price: widget.product.price * 0.8,
      ),
      widget.product.copyWith(
        id: 'similar_3',
        name: '${widget.product.name} Premium',
        price: widget.product.price * 1.5,
      ),
      widget.product.copyWith(
        id: 'similar_4',
        name: '${widget.product.name} Plus',
        price: widget.product.price * 1.1,
      ),
    ]);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _favoriteAnimController.dispose();
    super.dispose();
  }

  void _toggleFavorite() async {
    await _favoriteAnimController.forward();
    await _favoriteAnimController.reverse();
    setState(() {
      _isFavorite = !_isFavorite;
    });
    _showSnackBar(
      _isFavorite ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích',
      icon: _isFavorite ? Icons.favorite : Icons.favorite_border,
    );
  }

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

  void _addToCart() async {
    if (widget.product.stock <= 0) return;

    setState(() {
      _isAddingToCart = true;
    });

    // Simulate API call
    await Future.delayed(const Duration(milliseconds: 500));

    setState(() {
      _isAddingToCart = false;
    });

    _showSnackBar(
      'Đã thêm $_quantity sản phẩm vào giỏ hàng',
      icon: Icons.check_circle,
      action: SnackBarAction(
        label: 'Xem giỏ',
        onPressed: () => context.push('/cart'),
      ),
    );
  }

  void _buyNow() async {
    if (widget.product.stock <= 0) return;

    setState(() {
      _isBuyingNow = true;
    });

    // Simulate API call
    await Future.delayed(const Duration(milliseconds: 500));

    if (!mounted) return;
    
    setState(() {
      _isBuyingNow = false;
    });

    // Navigate to checkout
    context.push('/checkout');
  }

  void _showSnackBar(
    String message, {
    IconData? icon,
    SnackBarAction? action,
  }) {
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

  void _shareProduct() {
    _showSnackBar('Đang chia sẻ sản phẩm...', icon: Icons.share);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫');
    final allImages = [
      widget.product.imageUrl,
      ...widget.product.images.where((img) => img != widget.product.imageUrl),
    ].where((img) => img.isNotEmpty).toList();

    return Scaffold(
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // App bar with image carousel
          SliverAppBar(
            expandedHeight: 380,
            pinned: true,
            stretch: true,
            leading: _buildBackButton(theme),
            actions: [
              _buildShareButton(theme),
              _buildFavoriteButton(theme),
            ],
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
                  // Category badge
                  _buildCategoryBadge(theme),
                  const SizedBox(height: 12),

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
                  _buildRatingAndSold(theme),
                  const Divider(height: 32),

                  // Stock status
                  _buildStockStatus(theme),
                  const Divider(height: 32),

                  // Variant selectors
                  _buildVariantSelectors(theme),
                  const Divider(height: 32),

                  // Quantity selector
                  _buildQuantitySection(theme),
                  const Divider(height: 32),

                  // Description
                  _buildDescriptionSection(theme),
                  const SizedBox(height: 24),

                  // Similar products
                  if (_similarProducts.isNotEmpty) _buildSimilarProducts(theme),

                  // Bottom padding for sticky bar
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),

      // Sticky bottom bar
      bottomSheet: _buildBottomBar(theme),
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
          onPressed: _shareProduct,
        ),
      ),
    );
  }

  Widget _buildFavoriteButton(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.3),
          shape: BoxShape.circle,
        ),
        child: IconButton(
          icon: AnimatedBuilder(
            animation: _favoriteScaleAnimation,
            builder: (context, child) => Transform.scale(
              scale: _favoriteScaleAnimation.value,
              child: Icon(
                _isFavorite ? Icons.favorite : Icons.favorite_border,
                color: _isFavorite ? Colors.red : Colors.white,
              ),
            ),
          ),
          onPressed: _toggleFavorite,
        ),
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
              fit: BoxFit.cover,
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
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 6,
              ),
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
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
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
          const SizedBox(width: 12),
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

  Widget _buildRatingAndSold(ThemeData theme) {
    final soldCount = widget.product.reviewCount * 12; // Demo sold count

    return Row(
      children: [
        // Rating
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.amber.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            children: [
              const Icon(Icons.star_rounded, size: 16, color: Colors.amber),
              const SizedBox(width: 4),
              Text(
                widget.product.rating.toStringAsFixed(1),
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '(${_formatCount(widget.product.reviewCount)} đánh giá)',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),

        // Sold count
        Text(
          'Đã bán ${_formatCount(soldCount)}',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _buildStockStatus(ThemeData theme) {
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
        Text(
          inStock
              ? (isLowStock
                  ? 'Còn ít hàng (${widget.product.stock})'
                  : 'Còn hàng')
              : 'Hết hàng',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: inStock
                ? (isLowStock ? Colors.orange : Colors.green)
                : theme.colorScheme.error,
            fontWeight: isLowStock ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ],
    );
  }

  Widget _buildVariantSelectors(ThemeData theme) {
    return VariantSelector(
      selectedColor: _selectedColor,
      colors: _availableColors,
      onColorSelected: (colorId) {
        setState(() {
          _selectedColor = colorId;
        });
      },
      selectedSize: _selectedSize,
      sizes: _availableSizes,
      onSizeSelected: (sizeId) {
        setState(() {
          _selectedSize = sizeId;
        });
      },
    );
  }

  Widget _buildQuantitySection(ThemeData theme) {
    return Row(
      children: [
        Text(
          'Số lượng',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const Spacer(),
        QuantitySelector(
          quantity: _quantity,
          onQuantityChanged: (qty) {
            setState(() {
              _quantity = qty;
            });
          },
          maxQuantity: widget.product.stock > 0 ? widget.product.stock : 1,
          isDisabled: widget.product.stock <= 0,
        ),
      ],
    );
  }

  Widget _buildDescriptionSection(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Mô tả sản phẩm',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            IconButton(
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
                  : 'Không có mô tả cho sản phẩm này.',
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
                  : 'Không có mô tả cho sản phẩm này.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.6,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildSimilarProducts(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Sản phẩm tương tự',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            TextButton(
              onPressed: () {
                // Navigate to similar products
              },
              child: const Text('Xem thêm'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 260,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _similarProducts.length,
            separatorBuilder: (context, index) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              return SizedBox(
                width: 160,
                child: ProductGridItem(
                  product: _similarProducts[index],
                  onTap: () {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(
                        builder: (context) =>
                            ProductDetailPage(product: _similarProducts[index]),
                      ),
                    );
                  },
                  showFavoriteButton: false,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildBottomBar(ThemeData theme) {
    if (widget.product.stock <= 0) {
      return const SizedBox.shrink();
    }

    return Container(
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
        child: Row(
          children: [
            // Quantity selector (compact)
            _buildCompactQuantitySelector(theme),
            const SizedBox(width: 12),

            // Add to cart button
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: _isAddingToCart || _isBuyingNow ? null : _addToCart,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: theme.colorScheme.primaryContainer,
                  foregroundColor: theme.colorScheme.onPrimaryContainer,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isAddingToCart
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text(
                        'Thêm vào giỏ',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 12),

            // Buy now button
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: _isAddingToCart || _isBuyingNow ? null : _buyNow,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: theme.colorScheme.error,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isBuyingNow
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : const Text(
                        'Mua ngay',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactQuantitySelector(ThemeData theme) {
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
            onPressed: _quantity > 1 ? _decrementQuantity : null,
            iconSize: 20,
            constraints: const BoxConstraints(
              minWidth: 36,
              minHeight: 36,
            ),
          ),
          Container(
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
          IconButton(
            icon: const Icon(Icons.add, size: 18),
            onPressed: _quantity < widget.product.stock
                ? _incrementQuantity
                : null,
            iconSize: 20,
            constraints: const BoxConstraints(
              minWidth: 36,
              minHeight: 36,
            ),
          ),
        ],
      ),
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }
}
