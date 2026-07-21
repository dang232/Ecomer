---
name: use-cart-test-mocking-pattern
description: Proper mocking pattern for use-cart hook tests with global fetch spy
metadata:
  type: reference
---

# use-cart.test.tsx Mocking Pattern

## Key Discovery
The tests mock `fetch` via `vi.spyOn(global, "fetch")` NOT by mocking the cart module directly. This is because the API client (`lib/api/client.ts`) calls `fetch` directly, and the module-level mocks don't intercept the actual HTTP calls.

## Working Pattern
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchSpy = vi.spyOn(global, "fetch");

function cartEnvelope(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        items: data?.items ?? [],
        itemCount: data?.itemCount ?? 0,
        totalAmount: data?.totalAmount ?? 0,
      },
      // ... required envelope fields
    }),
    { headers: { "content-type": "application/json" } }
  );
}

beforeEach(() => {
  fetchSpy.mockReset();
  // Also spy on localStorage methods
  vi.spyOn(localStorage, "setItem");
  vi.spyOn(localStorage, "removeItem");
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// Usage in test:
fetchSpy.mockResolvedValueOnce(cartEnvelope({ items: [], itemCount: 0, totalAmount: 0 }));
```

## Mock Native Auth (required before importing client)
```typescript
vi.mock("../lib/auth/native-auth", () => ({
  getAccessToken: () => null,
  setLiveTokenSet: vi.fn(),
  refreshTokens: vi.fn(),
}));
```

## Query Invalidation Pattern
When testing functions that call `qc.invalidateQueries()`, add an extra mock response:
```typescript
// Initial fetch + refetch after mutation
fetchSpy
  .mockResolvedValueOnce(cartEnvelope(mockCart))
  .mockResolvedValueOnce(cartEnvelope(updatedCart));
```

## localStorage Spying
`localStorage.setItem` is bound differently - spy on it directly:
```typescript
const setItemSpy = vi.spyOn(localStorage, "setItem");
// Then: expect(setItemSpy).toHaveBeenCalledWith("vnshop:guest-cart", expect.any(String))
```

**Why:** `localStorage.setItem` is not reassignable, and `vi.mock` module exports aren't the same reference.
