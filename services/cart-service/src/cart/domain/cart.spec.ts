import { Cart } from './cart';
import { CartItemLimitExceededException } from './cart-item-limit-exceeded.exception';
import { CartItemNotFoundException } from './cart-item-not-found.exception';
import { CartItem } from './cart-item';
import { Money } from './money';

describe('Cart', () => {
  it('adds and merges items', () => {
    const cart = Cart.create('user-1');

    cart.addItem(
      CartItem.create('product-1', 'Keyboard', '', Money.of(1000), 2),
    );
    cart.addItem(
      CartItem.create('product-1', 'Keyboard', '', Money.of(1000), 3),
    );

    expect(cart.itemCount).toBe(5);
    expect(cart.uniqueItemCount).toBe(1);
    expect(cart.totalAmount.amount).toBe(5000);
  });

  it('rejects per-item quantity above max', () => {
    const cart = Cart.create('user-1');

    expect(() =>
      cart.addItem(
        CartItem.create('product-1', 'Keyboard', '', Money.of(1000), 11),
      ),
    ).toThrow(CartItemLimitExceededException);
  });

  it('removes item when quantity updates to zero', () => {
    const cart = Cart.create('user-1');
    cart.addItem(
      CartItem.create('product-1', 'Keyboard', '', Money.of(1000), 2),
    );

    cart.updateItemQuantity('product-1', 0);

    expect(cart.isEmpty).toBe(true);
  });

  it('throws when removing missing item', () => {
    const cart = Cart.create('user-1');

    expect(() => cart.removeItem('missing')).toThrow(CartItemNotFoundException);
  });

  describe('variant support', () => {
    it('preserves parcel metadata on a cart item', () => {
      const parcel = {
        weightGrams: 1500,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
      };
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create(
          'product-1',
          'T-Shirt',
          '',
          Money.of(200),
          1,
          'size-M',
          undefined,
          undefined,
          parcel,
        ),
      );

      expect(cart.items[0]?.parcel).toEqual(parcel);
    });

    it('does not replace valid parcel metadata with null when merging', () => {
      const parcel = {
        weightGrams: 1500,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
      };
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create(
          'product-1',
          'T-Shirt',
          '',
          Money.of(200),
          1,
          undefined,
          undefined,
          undefined,
          parcel,
        ),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 2),
      );

      expect(cart.items[0]?.quantity).toBe(3);
      expect(cart.items[0]?.parcel).toEqual(parcel);
    });

    it('same product with different variants = 2 distinct line items', () => {
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1, 'size-M'),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1, 'size-L'),
      );

      expect(cart.uniqueItemCount).toBe(2);
      expect(cart.itemCount).toBe(2);
    });

    it('same product with same variant = quantities merged', () => {
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 2, 'size-M'),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 3, 'size-M'),
      );

      expect(cart.uniqueItemCount).toBe(1);
      expect(cart.itemCount).toBe(5);
    });

    it('product without variant (null) works as before', () => {
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 2),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1),
      );

      expect(cart.uniqueItemCount).toBe(1);
      expect(cart.itemCount).toBe(3);
    });

    it('null variant and explicit null variant are the same item', () => {
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 2, null),
      );

      expect(cart.uniqueItemCount).toBe(1);
      expect(cart.itemCount).toBe(3);
    });

    it('removes a specific variant without touching other variants', () => {
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1, 'size-M'),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1, 'size-L'),
      );

      cart.removeItem('product-1:size-M');

      expect(cart.uniqueItemCount).toBe(1);
      expect(cart.items[0].variantId).toBe('size-L');
    });

    it('updates quantity for a specific variant', () => {
      const cart = Cart.create('user-1');

      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1, 'size-M'),
      );
      cart.addItem(
        CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1, 'size-L'),
      );

      cart.updateItemQuantity('product-1:size-M', 5);

      const sizeM = cart.items.find((i) => i.variantId === 'size-M');
      const sizeL = cart.items.find((i) => i.variantId === 'size-L');
      expect(sizeM?.quantity).toBe(5);
      expect(sizeL?.quantity).toBe(1);
    });

    it('itemKey is productId:variantId when variant present', () => {
      const item = CartItem.create(
        'product-1',
        'T-Shirt',
        '',
        Money.of(200),
        1,
        'size-M',
      );
      expect(item.itemKey).toBe('product-1:size-M');
    });

    it('itemKey is productId when variant absent', () => {
      const item = CartItem.create('product-1', 'T-Shirt', '', Money.of(200), 1);
      expect(item.itemKey).toBe('product-1');
    });
  });
});
