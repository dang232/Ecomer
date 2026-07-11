import { CartDomainException } from './cart-domain.exception';

export class VariantNotFoundException extends CartDomainException {
  constructor(productId: string, variantId: string) {
    super(`Variant ${variantId} not found for product ${productId}`, 'VARIANT_NOT_FOUND');
  }
}
