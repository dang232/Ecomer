import { ProductHttpClientAdapter } from './product-http-client.adapter';
import { ProductNotFoundException } from '../domain/product-not-found.exception';

describe('ProductHttpClientAdapter', () => {
  const URL = 'http://product-service:8082';

  function mockFetch(body: unknown, status = 200): void {
    (global as { fetch: typeof fetch }).fetch = (() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      } as unknown as Response)) as typeof fetch;
  }

  afterEach(() => {
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it('returns offline-mode snapshot when productServiceUrl is missing', async () => {
    const adapter = new ProductHttpClientAdapter(undefined);
    const snap = await adapter.getSnapshot('p-1');
    expect(snap.productId).toBe('p-1');
    expect(snap.productName).toBe('p-1');
    expect(snap.productImage).toBe('');
    expect(snap.unitPrice.amount).toBe(0);
  });

  it('throws ProductNotFoundException on 404', async () => {
    mockFetch({}, 404);
    const adapter = new ProductHttpClientAdapter(URL);
    await expect(adapter.getSnapshot('missing')).rejects.toBeInstanceOf(
      ProductNotFoundException,
    );
  });

  it('reads price from variants[0].priceAmount when no top-level price exists (live BE shape)', async () => {
    // Mirrors the real product-service ProductResponse: no flat price/image,
    // first variant carries priceAmount + priceCurrency.
    mockFetch({
      id: 'p-1',
      name: 'Tai nghe Sony WH-1000XM5',
      variants: [
        {
          sku: 'WH-1000XM5-BLACK',
          name: 'Black',
          priceAmount: 8990000,
          priceCurrency: 'VND',
          imageUrl: 'https://cdn/wh1000xm5-variant.jpg',
          stockQuantity: 12,
        },
      ],
      images: [{ url: 'https://cdn/wh1000xm5-hero.jpg', sortOrder: 0 }],
    });

    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-1');
    expect(snap.productId).toBe('p-1');
    expect(snap.productName).toBe('Tai nghe Sony WH-1000XM5');
    expect(snap.productImage).toBe('https://cdn/wh1000xm5-hero.jpg');
    expect(snap.unitPrice.amount).toBe(8990000);
    expect(snap.unitPrice.currency).toBe('VND');
    expect(snap.parcel).toBeNull();
  });

  it('selects parcel metadata from the requested variant', async () => {
    mockFetch({
      id: 'p-parcel',
      variants: [
        {
          sku: 'small',
          priceAmount: 100,
          parcel: { weightGrams: 500, lengthCm: 10, widthCm: 10, heightCm: 5 },
        },
        {
          sku: 'large',
          priceAmount: 200,
          parcel: { weightGrams: 1500, lengthCm: 30, widthCm: 20, heightCm: 10 },
        },
      ],
    });

    const snap = await new ProductHttpClientAdapter(URL).getSnapshot('p-parcel', 'large');

    expect(snap.parcel).toEqual({
      weightGrams: 1500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    });
  });

  it('falls back to variants[0].imageUrl when images[] is empty', async () => {
    mockFetch({
      id: 'p-2',
      name: 'iPhone 16',
      variants: [
        {
          sku: 'IP16',
          priceAmount: 31990000,
          priceCurrency: 'VND',
          imageUrl: 'https://cdn/iphone16-variant.jpg',
        },
      ],
      images: [],
    });

    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-2');
    expect(snap.productImage).toBe('https://cdn/iphone16-variant.jpg');
  });

  it('picks the lowest-sortOrder image when images[] has multiple entries', async () => {
    mockFetch({
      id: 'p-3',
      name: 'MacBook Air',
      variants: [{ priceAmount: 27490000, priceCurrency: 'VND' }],
      images: [
        { url: 'https://cdn/mba-2.jpg', sortOrder: 1 },
        { url: 'https://cdn/mba-1.jpg', sortOrder: 0 },
        { url: 'https://cdn/mba-3.jpg', sortOrder: 2 },
      ],
    });

    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-3');
    expect(snap.productImage).toBe('https://cdn/mba-1.jpg');
  });

  it('honours flat top-level price when present (legacy/read-model shape)', async () => {
    mockFetch({
      productId: 'p-4',
      productName: 'Apple Watch',
      productImage: 'https://cdn/aw.jpg',
      price: 9990000,
      currency: 'VND',
    });

    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-4');
    expect(snap.unitPrice.amount).toBe(9990000);
    expect(snap.productImage).toBe('https://cdn/aw.jpg');
  });

  it('honours top-level Money-shaped price', async () => {
    mockFetch({
      id: 'p-5',
      name: 'T-shirt',
      price: { amount: 199000, currency: 'VND' },
      images: [{ url: 'https://cdn/tee.jpg', sortOrder: 0 }],
    });

    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-5');
    expect(snap.unitPrice.amount).toBe(199000);
  });

  it('unwraps {data: ...} envelope shape', async () => {
    mockFetch({
      data: {
        id: 'p-6',
        name: 'Wrapped',
        variants: [{ priceAmount: 50000, priceCurrency: 'VND' }],
      },
    });

    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-6');
    expect(snap.productName).toBe('Wrapped');
    expect(snap.unitPrice.amount).toBe(50000);
  });

  it('returns 0 VND with productId-as-name when product has neither variants nor flat price', async () => {
    mockFetch({ id: 'p-7' });
    const adapter = new ProductHttpClientAdapter(URL);
    const snap = await adapter.getSnapshot('p-7');
    expect(snap.productName).toBe('p-7');
    expect(snap.unitPrice.amount).toBe(0);
  });
});
