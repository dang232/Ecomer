import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/design_system/components/async_state_view.dart';
import '../../data/models/product_model.dart';
import '../../domain/repositories/product_repository.dart';
import '../../../reviews/domain/repositories/review_repository.dart';
import '../../../reviews/presentation/bloc/review_cubit.dart';
import 'product_detail_page.dart';

typedef ProductDetailBuilder =
    Widget Function(BuildContext context, ProductModel product);

class ProductDetailRoutePage extends StatefulWidget {
  const ProductDetailRoutePage({
    required this.productId,
    this.initialProduct,
    this.productBuilder,
    super.key,
  });

  final String productId;
  final ProductModel? initialProduct;
  final ProductDetailBuilder? productBuilder;

  @override
  State<ProductDetailRoutePage> createState() => _ProductDetailRoutePageState();
}

class _ProductDetailRoutePageState extends State<ProductDetailRoutePage> {
  ProductModel? _product;
  Object? _error;
  var _isLoading = true;

  @override
  void initState() {
    super.initState();
    _resolveProduct();
  }

  @override
  void didUpdateWidget(ProductDetailRoutePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.productId != widget.productId ||
        oldWidget.initialProduct != widget.initialProduct) {
      _resolveProduct();
    }
  }

  void _resolveProduct() {
    final initial = widget.initialProduct;
    if (initial != null && initial.id == widget.productId) {
      _product = initial;
      _error = null;
      _isLoading = false;
      return;
    }
    _loadProduct();
  }

  Future<void> _loadProduct() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _product = null;
    });

    try {
      final product = await context.read<ProductRepository>().getProductById(
        widget.productId,
      );
      if (!mounted) return;
      setState(() {
        _product = product;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = _product;
    if (product != null) {
      final customProduct = widget.productBuilder?.call(context, product);
      if (customProduct != null) return customProduct;

      return BlocProvider(
        create: (context) => ReviewCubit(
          repository: context.read<ReviewRepository>(),
          productId: product.id,
        )..load(),
        child: ProductDetailPage(product: product),
      );
    }

    final status = resolveAsyncViewStatus(
      isLoading: _isLoading,
      hasError: _error != null,
      isEmpty: !_isLoading && _error == null,
      hasData: false,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết sản phẩm')),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: AsyncStateView(
              status: status,
              loading: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Đang tải sản phẩm'),
                ],
              ),
              error: const _RouteMessage(
                icon: Icons.cloud_off_outlined,
                title: 'Không thể tải sản phẩm',
                message: 'Kiểm tra kết nối rồi thử lại.',
              ),
              empty: const _RouteMessage(
                icon: Icons.inventory_2_outlined,
                title: 'Sản phẩm không khả dụng',
                message: 'Sản phẩm có thể đã bị gỡ hoặc ngừng bán.',
              ),
              retryLabel: 'Thử lại',
              onRetry: _loadProduct,
              child: const SizedBox.shrink(),
            ),
          ),
        ),
      ),
    );
  }
}

class _RouteMessage extends StatelessWidget {
  const _RouteMessage({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 40, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(height: 16),
        Text(
          title,
          textAlign: TextAlign.center,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
