import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("..", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("payment reads and order reads are not Spring-cache annotated", async () => {
  const payment = await source(
    "services/payment-service/src/main/java/com/vnshop/paymentservice/domain/port/out/PaymentRepositoryPort.java",
  );
  const order = await source(
    "services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/persistence/OrderJpaRepository.java",
  );
  assert.doesNotMatch(payment, /@Cacheable/);
  assert.doesNotMatch(payment, /@CachePut/);
  assert.doesNotMatch(order, /@Cacheable[\s\S]*findById/);
  assert.doesNotMatch(order, /@CachePut[\s\S]*findById/);
});

test("cache probes retain bounded negative-cache and jitter contracts", async () => {
  const productConfig = await source(
    "services/product-service/src/main/java/com/vnshop/productservice/infrastructure/cache/CacheConfig.java",
  );
  const orderConfig = await source(
    "services/order-service/src/main/java/com/vnshop/orderservice/infrastructure/cache/CacheConfig.java",
  );
  assert.match(productConfig, /Duration\.ofSeconds\(30\)/);
  assert.match(orderConfig, /Duration\.ofSeconds\(30\)/);
  assert.match(productConfig, /nextLong\(270, 331\)/);
  assert.match(orderConfig, /nextLong\(270, 331\)/);
});
