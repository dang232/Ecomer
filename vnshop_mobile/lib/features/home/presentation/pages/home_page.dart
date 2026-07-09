import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../widgets/banner_carousel.dart';
import '../widgets/category_chips.dart';
import '../widgets/search_bar.dart';
import '../widgets/section_header.dart';

/// Complete home page with search, categories, banners, and products
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with TickerProviderStateMixin {
  final ScrollController _scrollController = ScrollController();

  // Animation controllers for staggered animations
  late final AnimationController _staggerController;
  late final List<Animation<double>> _staggerAnimations;

  // Demo data
  int _selectedCategoryIndex = 0;

  // Sample categories
  final List<CategoryChipData> _categories = const [
    CategoryChipData(id: 'all', name: 'Tất cả', icon: Icons.apps),
    CategoryChipData(id: 'electronics', name: 'Điện tử', icon: Icons.devices),
    CategoryChipData(id: 'fashion', name: 'Thời trang', icon: Icons.checkroom),
    CategoryChipData(id: 'home', name: 'Nhà cửa', icon: Icons.home),
    CategoryChipData(id: 'beauty', name: 'Làm đẹp', icon: Icons.spa),
    CategoryChipData(id: 'sports', name: 'Thể thao', icon: Icons.sports_basketball),
    CategoryChipData(id: 'books', name: 'Sách', icon: Icons.menu_book),
    CategoryChipData(id: 'toys', name: 'Đồ chơi', icon: Icons.toys),
  ];

  // Sample banners
  final List<BannerData> _banners = const [
    BannerData(
      title: 'Flash Sale 50%',
      subtitle: 'Chỉ hôm nay!',
      isFlashSale: true,
      gradientColors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
    ),
    BannerData(
      title: 'Miễn phí vận chuyển',
      subtitle: 'Đơn hàng từ 200K',
      gradientColors: [Color(0xFF4ECDC4), Color(0xFF44A08D)],
    ),
    BannerData(
      title: 'Tech Week 2024',
      subtitle: 'Gaming gear giảm đến 30%',
      gradientColors: [Color(0xFF667EEA), Color(0xFF764BA2)],
    ),
  ];

  // Sample products
  final List<ProductData> _featuredProducts = [
    const ProductData(
      id: '1',
      name: 'iPhone 15 Pro Max',
      price: 29990000,
      originalPrice: 34990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.8,
      reviewCount: 1234,
    ),
    const ProductData(
      id: '2',
      name: 'MacBook Air M3',
      price: 28990000,
      originalPrice: 32990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.9,
      reviewCount: 856,
    ),
    const ProductData(
      id: '3',
      name: 'AirPods Pro 2',
      price: 6990000,
      originalPrice: 7990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.7,
      reviewCount: 2341,
    ),
    const ProductData(
      id: '4',
      name: 'Samsung Galaxy S24',
      price: 24990000,
      originalPrice: 28990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.6,
      reviewCount: 567,
    ),
  ];

  final List<ProductData> _promotionProducts = [
    const ProductData(
      id: '5',
      name: 'Tai nghe Sony WH-1000XM5',
      price: 7990000,
      originalPrice: 11990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.9,
      reviewCount: 1890,
      discountPercent: 33,
    ),
    const ProductData(
      id: '6',
      name: 'Bàn phím cơ Keychron Q1',
      price: 3590000,
      originalPrice: 4990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.8,
      reviewCount: 432,
      discountPercent: 28,
    ),
    const ProductData(
      id: '7',
      name: 'Chuột Logitech MX Master 3S',
      price: 2490000,
      originalPrice: 3490000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.7,
      reviewCount: 765,
      discountPercent: 29,
    ),
    const ProductData(
      id: '8',
      name: 'Màn hình LG 27" 4K',
      price: 14990000,
      originalPrice: 19990000,
      imageUrl: 'https://via.placeholder.com/200',
      rating: 4.6,
      reviewCount: 234,
      discountPercent: 25,
    ),
  ];

  @override
  void initState() {
    super.initState();

    // Initialize staggered animations
    _staggerController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _staggerAnimations = List.generate(6, (index) {
      return Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(
          parent: _staggerController,
          curve: Interval(
            index * 0.1,
            0.6 + index * 0.1,
            curve: Curves.easeOut,
          ),
        ),
      );
    });

    // Start staggered animation
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) {
        _staggerController.forward();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _staggerController.dispose();
    super.dispose();
  }

  Future<void> _onRefresh() async {
    // Simulate network delay
    await Future.delayed(const Duration(seconds: 1));

    // Reset and replay animations
    _staggerController.reset();
    _staggerController.forward();
  }

  void _onSearch(String query) {
    debugPrint('Search query: $query');
  }

  void _onCategorySelected(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });
  }

  String _formatPrice(double price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1)}tr';
    } else if (price >= 1000) {
      return '${(price / 1000).toStringAsFixed(0)}K';
    }
    return price.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _onRefresh,
          child: CustomScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              // App Bar with Search
              SliverToBoxAdapter(
                child: AnimatedBuilder(
                  animation: _staggerAnimations.isNotEmpty
                      ? _staggerAnimations[0]
                      : const AlwaysStoppedAnimation(1.0),
                  builder: (context, child) {
                    return Opacity(
                      opacity: _staggerAnimations.isNotEmpty
                          ? _staggerAnimations[0].value
                          : 1.0,
                      child: Transform.translate(
                        offset: Offset(
                            0, 12 * (1 - (_staggerAnimations.isNotEmpty
                                ? _staggerAnimations[0].value
                                : 1.0))),
                        child: child,
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: HomeSearchBar(
                            onSearch: _onSearch,
                            hintText: 'Tìm kiếm sản phẩm...',
                          ),
                        ),
                        const SizedBox(width: 12),
                        _IconButtonWithScale(
                          icon: Icons.notifications_outlined,
                          onTap: () {},
                          badge: 3,
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Category Chips
              SliverToBoxAdapter(
                child: AnimatedBuilder(
                  animation: _staggerAnimations.length > 1
                      ? _staggerAnimations[1]
                      : const AlwaysStoppedAnimation(1.0),
                  builder: (context, child) {
                    return Opacity(
                      opacity: _staggerAnimations.length > 1
                          ? _staggerAnimations[1].value
                          : 1.0,
                      child: Transform.translate(
                        offset: Offset(
                            0, 12 * (1 - (_staggerAnimations.length > 1
                                ? _staggerAnimations[1].value
                                : 1.0))),
                        child: child,
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: CategoryChips(
                      categories: _categories,
                      selectedIndex: _selectedCategoryIndex,
                      onCategorySelected: _onCategorySelected,
                    ),
                  ),
                ),
              ),

              // Banner Carousel
              SliverToBoxAdapter(
                child: AnimatedBuilder(
                  animation: _staggerAnimations.length > 2
                      ? _staggerAnimations[2]
                      : const AlwaysStoppedAnimation(1.0),
                  builder: (context, child) {
                    return Opacity(
                      opacity: _staggerAnimations.length > 2
                          ? _staggerAnimations[2].value
                          : 1.0,
                      child: Transform.translate(
                        offset: Offset(
                            0, 12 * (1 - (_staggerAnimations.length > 2
                                ? _staggerAnimations[2].value
                                : 1.0))),
                        child: child,
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    child: BannerCarousel(
                      banners: _banners,
                      height: 180,
                      onBannerTap: (index) {
                        // Handle banner tap
                        debugPrint('Banner tapped: $index');
                      },
                    ),
                  ),
                ),
              ),

              // Featured Products Section
              SliverToBoxAdapter(
                child: AnimatedSectionHeader(
                  title: 'Sản phẩm nổi bật',
                  icon: Icons.star_rounded,
                  staggerIndex: 3,
                  onSeeAllTap: () => context.push('/products'),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.65,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      return AnimatedBuilder(
                        animation: _staggerAnimations.length > 3
                            ? _staggerAnimations[3]
                            : const AlwaysStoppedAnimation(1.0),
                        builder: (context, child) {
                          final delay = index * 0.1;
                          final animValue = (_staggerAnimations.length > 3
                                  ? _staggerAnimations[3].value
                                  : 1.0)
                              .clamp(0.0, 1.0);
                          final delayedValue =
                              (animValue - delay).clamp(0.0, 1.0) / (1 - delay);

                          return Opacity(
                            opacity: delayedValue,
                            child: Transform.translate(
                              offset: Offset(0, 16 * (1 - delayedValue)),
                              child: child,
                            ),
                          );
                        },
                        child: _ProductCard(
                          product: _featuredProducts[index],
                          formatPrice: _formatPrice,
                        ),
                      );
                    },
                    childCount: _featuredProducts.length,
                  ),
                ),
              ),

              // Promotion Section
              SliverToBoxAdapter(
                child: AnimatedSectionHeader(
                  title: 'Khuyến mãi',
                  subtitle: 'Ưu đãi hấp dẫn trong ngày',
                  icon: Icons.local_offer_rounded,
                  titleColor: Colors.red,
                  staggerIndex: 4,
                  onSeeAllTap: () => context.push('/promotions'),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.65,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      return AnimatedBuilder(
                        animation: _staggerAnimations.length > 5
                            ? _staggerAnimations[5]
                            : const AlwaysStoppedAnimation(1.0),
                        builder: (context, child) {
                          final delay = index * 0.1;
                          final animValue = (_staggerAnimations.length > 5
                                  ? _staggerAnimations[5].value
                                  : 1.0)
                              .clamp(0.0, 1.0);
                          final delayedValue =
                              (animValue - delay).clamp(0.0, 1.0) / (1 - delay);

                          return Opacity(
                            opacity: delayedValue,
                            child: Transform.translate(
                              offset: Offset(0, 16 * (1 - delayedValue)),
                              child: child,
                            ),
                          );
                        },
                        child: _ProductCard(
                          product: _promotionProducts[index],
                          formatPrice: _formatPrice,
                          showDiscount: true,
                        ),
                      );
                    },
                    childCount: _promotionProducts.length,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Icon button with scale animation and optional badge
class _IconButtonWithScale extends StatefulWidget {
  const _IconButtonWithScale({
    required this.icon,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final VoidCallback onTap;
  final int? badge;

  @override
  State<_IconButtonWithScale> createState() => _IconButtonWithScaleState();
}

class _IconButtonWithScaleState extends State<_IconButtonWithScale>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.92).animate(
      CurvedAnimation(
        parent: _scaleController,
        curve: Curves.easeOut,
      ),
    );
  }

  @override
  void dispose() {
    _scaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTapDown: (_) => _scaleController.forward(),
      onTapUp: (_) {
        _scaleController.reverse();
        widget.onTap();
      },
      onTapCancel: () => _scaleController.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          );
        },
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(
                widget.icon,
                color: theme.colorScheme.onSurface,
              ),
              if (widget.badge != null)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      widget.badge! > 9 ? '9+' : widget.badge.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Product card widget with scale on press
class _ProductCard extends StatefulWidget {
  const _ProductCard({
    required this.product,
    required this.formatPrice,
    this.showDiscount = false,
  });

  final ProductData product;
  final String Function(double) formatPrice;
  final bool showDiscount;

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleController;
  late final Animation<double> _scaleAnimation;

  bool _isFavorite = false;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.96).animate(
      CurvedAnimation(
        parent: _scaleController,
        curve: Curves.easeOut,
      ),
    );
  }

  @override
  void dispose() {
    _scaleController.dispose();
    super.dispose();
  }

  int _calculateDiscount(int original, int current) {
    if (original <= current) return 0;
    return ((original - current) / original * 100).round();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final discount = _calculateDiscount(
      widget.product.originalPrice.toInt(),
      widget.product.price.toInt(),
    );

    return GestureDetector(
      onTapDown: (_) => _scaleController.forward(),
      onTapUp: (_) {
        _scaleController.reverse();
        // Navigate to product detail
      },
      onTapCancel: () => _scaleController.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          );
        },
        child: Container(
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image section
              Expanded(
                flex: 3,
                child: Stack(
                  children: [
                    // Product image
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerHighest,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(12),
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(12),
                        ),
                        child: Image.network(
                          widget.product.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              color: theme.colorScheme.surfaceContainerHighest,
                              child: Icon(
                                Icons.image_outlined,
                                size: 48,
                                color: theme.colorScheme.outline,
                              ),
                            );
                          },
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) return child;
                            return Container(
                              color: theme.colorScheme.surfaceContainerHighest,
                              child: const Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),

                    // Discount badge
                    if (widget.showDiscount || discount > 0)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '-${widget.product.discountPercent ?? discount}%',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),

                    // Favorite button
                    Positioned(
                      top: 8,
                      right: 8,
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _isFavorite = !_isFavorite;
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.surface.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _isFavorite
                                ? Icons.favorite
                                : Icons.favorite_border,
                            size: 18,
                            color: _isFavorite ? Colors.red : theme.colorScheme.outline,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Content section
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product name
                      Text(
                        widget.product.name,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          height: 1.2,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),

                      // Price
                      Row(
                        children: [
                          Text(
                            widget.formatPrice(widget.product.price),
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (widget.product.originalPrice > widget.product.price) ...[
                            const SizedBox(width: 6),
                            Text(
                              widget.formatPrice(widget.product.originalPrice),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.outline,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),

                      const Spacer(),

                      // Rating
                      Row(
                        children: [
                          Icon(
                            Icons.star_rounded,
                            size: 14,
                            color: Colors.amber.shade600,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            widget.product.rating.toStringAsFixed(1),
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '(${widget.product.reviewCount})',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Product data model
class ProductData {
  const ProductData({
    required this.id,
    required this.name,
    required this.price,
    required this.originalPrice,
    required this.imageUrl,
    required this.rating,
    required this.reviewCount,
    this.discountPercent,
  });

  final String id;
  final String name;
  final double price;
  final double originalPrice;
  final String imageUrl;
  final double rating;
  final int reviewCount;
  final int? discountPercent;
}
