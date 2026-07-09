import 'dart:async';

import 'package:flutter/material.dart';
import 'package:vnshop_mobile/common/widgets/images/safe_network_image.dart';

/// Auto-scrolling banner carousel with page indicators
class BannerCarousel extends StatefulWidget {
  const BannerCarousel({
    super.key,
    required this.banners,
    this.height = 180,
    this.autoPlayDuration = const Duration(seconds: 4),
    this.onBannerTap,
    this.borderRadius = 12,
  });

  final List<BannerData> banners;
  final double height;
  final Duration autoPlayDuration;
  final ValueChanged<int>? onBannerTap;
  final double borderRadius;

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel>
    with SingleTickerProviderStateMixin {
  late final PageController _pageController;
  late final AnimationController _animationController;
  Timer? _autoPlayTimer;

  int _currentPage = 0;
  bool _isHovering = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.92);
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    _startAutoPlay();
  }

  @override
  void dispose() {
    _autoPlayTimer?.cancel();
    _pageController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  void _startAutoPlay() {
    _autoPlayTimer?.cancel();
    _autoPlayTimer = Timer.periodic(widget.autoPlayDuration, (_) {
      if (!_isHovering && mounted) {
        _goToNextPage();
      }
    });
  }

  void _goToNextPage() {
    final nextPage = (_currentPage + 1) % widget.banners.length;
    _pageController.animateToPage(
      nextPage,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
  }

  void _onPageChanged(int page) {
    setState(() {
      _currentPage = page;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovering = true),
      onExit: (_) => setState(() => _isHovering = false),
      child: Column(
        children: [
          // Banner pages
          SizedBox(
            height: widget.height,
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: _onPageChanged,
              itemCount: widget.banners.length,
              itemBuilder: (context, index) {
                return _BannerSlide(
                  banner: widget.banners[index],
                  height: widget.height,
                  borderRadius: widget.borderRadius,
                  onTap: () => widget.onBannerTap?.call(index),
                  isActive: index == _currentPage,
                );
              },
            ),
          ),

          // Page indicators
          if (widget.banners.length > 1) ...[
            const SizedBox(height: 12),
            _PageIndicator(
              pageCount: widget.banners.length,
              currentPage: _currentPage,
              activeColor: theme.colorScheme.primary,
              inactiveColor: theme.colorScheme.outline.withValues(alpha: 0.3),
            ),
          ],
        ],
      ),
    );
  }
}

/// Individual banner slide with scale animation
class _BannerSlide extends StatefulWidget {
  const _BannerSlide({
    required this.banner,
    required this.height,
    required this.borderRadius,
    required this.onTap,
    required this.isActive,
  });

  final BannerData banner;
  final double height;
  final double borderRadius;
  final VoidCallback onTap;
  final bool isActive;

  @override
  State<_BannerSlide> createState() => _BannerSlideState();
}

class _BannerSlideState extends State<_BannerSlide>
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
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.98), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 0.98, end: 1.0), weight: 50),
    ]).animate(
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

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: GestureDetector(
        onTapDown: (_) {
          _scaleController.forward();
        },
        onTapUp: (_) {
          _scaleController.reverse();
          widget.onTap();
        },
        onTapCancel: () {
          _scaleController.reverse();
        },
        child: AnimatedBuilder(
          animation: _scaleAnimation,
          builder: (context, child) {
            return Transform.scale(
              scale: _scaleAnimation.value,
              child: child,
            );
          },
          child: Container(
            height: widget.height,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(widget.borderRadius),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(widget.borderRadius),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Background image or gradient
                  if (widget.banner.imageUrl != null)
                    SafeNetworkImage(
                      url: widget.banner.imageUrl,
                      fit: BoxFit.cover,
                    )
                  else
                    _GradientBanner(banner: widget.banner),

                  // Content overlay
                  if (widget.banner.title != null ||
                      widget.banner.subtitle != null)
                    Positioned(
                      left: 16,
                      bottom: 16,
                      right: 16,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (widget.banner.title != null)
                            Text(
                              widget.banner.title!,
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                shadows: [
                                  Shadow(
                                    color: Colors.black.withValues(alpha: 0.5),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                            ),
                          if (widget.banner.subtitle != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              widget.banner.subtitle!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: Colors.white.withValues(alpha: 0.9),
                                shadows: [
                                  Shadow(
                                    color: Colors.black.withValues(alpha: 0.5),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                  // Flash sale badge
                  if (widget.banner.isFlashSale)
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.local_fire_department,
                              color: Colors.white,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'FLASH SALE',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Gradient fallback banner when image is not available
class _GradientBanner extends StatelessWidget {
  const _GradientBanner({required this.banner});

  final BannerData banner;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: banner.gradientColors ??
              [
                Theme.of(context).colorScheme.primary,
                Theme.of(context).colorScheme.secondary,
              ],
        ),
      ),
    );
  }
}

/// Page indicator dots
class _PageIndicator extends StatelessWidget {
  const _PageIndicator({
    required this.pageCount,
    required this.currentPage,
    required this.activeColor,
    required this.inactiveColor,
  });

  final int pageCount;
  final int currentPage;
  final Color activeColor;
  final Color inactiveColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(pageCount, (index) {
        final isActive = index == currentPage;

        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: isActive ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? activeColor : inactiveColor,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

/// Data class for banner content
class BannerData {
  const BannerData({
    this.imageUrl,
    this.title,
    this.subtitle,
    this.gradientColors,
    this.isFlashSale = false,
    this.onTap,
  });

  final String? imageUrl;
  final String? title;
  final String? subtitle;
  final List<Color>? gradientColors;
  final bool isFlashSale;
  final VoidCallback? onTap;
}
