import { CartDomainException } from './cart-domain.exception';

export class PricingUnavailableException extends CartDomainException {
  constructor(productId: string) {
    super(`Product pricing is unavailable for ${productId}`, 'PRICING_UNAVAILABLE');
  }
}
