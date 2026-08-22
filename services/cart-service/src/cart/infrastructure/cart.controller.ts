import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { AddToCartUseCase } from '../application/add-to-cart.use-case';
import { ClearCartUseCase } from '../application/clear-cart.use-case';
import { MergeCartUseCase } from '../application/merge-cart.use-case';
import { RemoveCartItemUseCase } from '../application/remove-cart-item.use-case';
import { UpdateCartItemUseCase } from '../application/update-cart-item.use-case';
import { ViewCartUseCase } from '../application/view-cart.use-case';
import type { CartResponse } from '../application/cart.response';
import { CartItem } from '../domain/cart-item';
import { ApiResponse } from './api-response';
import { CartExceptionFilter } from './cart.exception-filter';
import type { AddCartItemRequest } from './add-cart-item.request';
import type { UpdateCartItemRequest } from './update-cart-item.request';
import type { MergeCartRequest } from './merge-cart.request';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import type { AuthenticatedRequest } from './auth/authenticated-request';

@Controller('cart')
@UseFilters(CartExceptionFilter)
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(
    private readonly addToCartUseCase: AddToCartUseCase,
    private readonly viewCartUseCase: ViewCartUseCase,
    private readonly updateCartItemUseCase: UpdateCartItemUseCase,
    private readonly removeCartItemUseCase: RemoveCartItemUseCase,
    private readonly clearCartUseCase: ClearCartUseCase,
    private readonly mergeCartUseCase: MergeCartUseCase,
  ) {}

  @Get()
  async viewCart(
    @Req() request: AuthenticatedRequest,
  ): Promise<ApiResponse<CartResponse>> {
    return ApiResponse.ok(
      await this.viewCartUseCase.execute(this.requireUserId(request.user.sub)),
    );
  }

  @Post('items')
  async addItem(
    @Req() requestContext: AuthenticatedRequest,
    @Body() request: AddCartItemRequest,
  ): Promise<ApiResponse<CartResponse>> {
    if (!request.productId) {
      throw new BadRequestException('productId is required');
    }

    const cart = await this.addToCartUseCase.execute({
      userId: this.requireUserId(requestContext.user.sub),
      productId: request.productId,
      quantity: request.quantity ?? 1,
      variantId: request.variantId ?? null,
    });

    return ApiResponse.ok('Cart item added', cart);
  }

  @Post('merge')
  async mergeCart(
    @Req() requestContext: AuthenticatedRequest,
    @Body() request: MergeCartRequest,
  ): Promise<ApiResponse<CartResponse>> {
    if (!request.sessionId || !request.idempotencyKey || !Array.isArray(request.items)) {
      throw new BadRequestException('sessionId, idempotencyKey, and items are required');
    }
    if (request.items.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      throw new BadRequestException('merge items must have a productId and positive integer quantity');
    }

    return ApiResponse.ok(
      'Cart merged',
      await this.mergeCartUseCase.execute(
        this.requireUserId(requestContext.user.sub),
        request.sessionId,
        request.items,
        request.idempotencyKey,
      ),
    );
  }

  /**
   * productId path param may include the full itemKey (productId:variantId) for
   * clients that already have the key, OR callers can pass variantId in the body
   * and the controller assembles the key.
   */
  @Put('items/:productId')
  async updateItem(
    @Req() requestContext: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() request: UpdateCartItemRequest,
  ): Promise<ApiResponse<CartResponse>> {
    if (request.quantity === undefined || request.quantity === null) {
      throw new BadRequestException('quantity is required');
    }

    const itemKey = CartItem.computeKey(productId, request.variantId ?? null);

    const cart = await this.updateCartItemUseCase.execute({
      userId: this.requireUserId(requestContext.user.sub),
      itemKey,
      quantity: request.quantity,
    });

    return ApiResponse.ok('Cart item updated', cart);
  }

  @Delete('items/:productId')
  async removeItem(
    @Req() requestContext: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() request: { variantId?: string } = {},
  ): Promise<ApiResponse<CartResponse>> {
    const itemKey = CartItem.computeKey(productId, request.variantId ?? null);

    const cart = await this.removeCartItemUseCase.execute({
      userId: this.requireUserId(requestContext.user.sub),
      itemKey,
    });

    return ApiResponse.ok('Cart item removed', cart);
  }

  @Delete()
  async clearCart(
    @Req() requestContext: AuthenticatedRequest,
  ): Promise<ApiResponse<null>> {
    await this.clearCartUseCase.execute(
      this.requireUserId(requestContext.user.sub),
    );
    return ApiResponse.ok('Cart cleared', null);
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) {
      throw new BadRequestException('authenticated user is required');
    }

    return userId;
  }
}
