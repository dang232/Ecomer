#!/usr/bin/env node
/**
 * Seed the local stack with a small demo catalog so the FE has something to render.
 *
 * Usage:
 *   node infra/scripts/seed-demo.mjs            # add demo products (skip if catalog non-empty)
 *   FORCE=1 node infra/scripts/seed-demo.mjs    # add even if catalog is non-empty
 *
 * Auth: uses the gateway's native auth boundary with the seeded
 * `seller1`/`test` user. All requests go through $GATEWAY.
 */

const GATEWAY = process.env.GATEWAY ?? "http://localhost:8080";
const SELLER_USER = process.env.SELLER_USER ?? "seller1";
const SELLER_PASS = process.env.SELLER_PASS ?? "test";
const FORCE = process.env.FORCE === "1";
const TARGET_BACKFILL_SKUS = new Set(["SKU-IPH16-PM-256", "SKU-MBA-M4-13"]);

const products = [
  // electronics
  ["Tai nghe Sony WH-1000XM5", "Chống ồn chủ động, pin 30h, hỗ trợ LDAC.", "electronics", "Sony", "SKU-SONY-WH-XM5", 8990000, 25, "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"],
  ["iPhone 16 Pro Max 256GB", "Chip A18 Pro, màn hình ProMotion, camera Fusion.", "electronics", "Apple", "SKU-IPH16-PM-256", 31990000, 10, "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80"],
  ["MacBook Air M4 13\"", "8GB RAM, 256GB SSD, vỏ nhôm tái chế.", "electronics", "Apple", "SKU-MBA-M4-13", 27490000, 8, "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80"],
  ["Apple Watch Series 10 GPS", "Màn hình OLED 46mm, đo SpO2, ECG.", "electronics", "Apple", "SKU-AW-10-46", 9990000, 12, "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80"],
  // fashion
  ["Áo thun cotton basic", "100% cotton, vai sườn, form regular fit.", "fashion", "Coolmate", "SKU-COOL-TEE-BLK", 199000, 120, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80"],
  ["Giày chạy bộ Nike Air Max", "Đệm Air, upper Flyknit, drop 10mm.", "fashion", "Nike", "SKU-NIKE-AM2026", 3290000, 30, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80"],
  ["Đầm hoa nhí mùa hè", "Vải lụa lạnh, dáng A, có lót.", "fashion", "Lily", "SKU-LILY-DRESS-1", 450000, 45, "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80"],
  // beauty
  ["Sữa rửa mặt CeraVe Foaming", "Phù hợp da dầu, không hương liệu, tuýp 236ml.", "beauty", "CeraVe", "SKU-CERAVE-FC-236", 380000, 60, "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80"],
  ["Son Tom Ford Lip Color", "Vỏ kim loại, màu Ruby Rush, 3g.", "beauty", "Tom Ford", "SKU-TF-LIP-RUBY", 1490000, 18, "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&q=80"],
  // home
  ["Bộ chăn ga gối Cotton 100%", "King size, cotton TC500, 4 món.", "home", "Everon", "SKU-EVR-BED-K", 1890000, 20, "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80"],
  ["Đèn bàn LED cảm ứng", "Cảm ứng cảm biến, 3 mức sáng, sạc USB-C.", "home", "Xiaomi", "SKU-MI-LAMP-1S", 690000, 35, "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80"],
  // sports
  ["Vợt cầu lông Yonex Astrox 88D", "Cân bằng, đầu nặng, sợi carbon HM.", "sports", "Yonex", "SKU-YNX-AX88D", 3990000, 15, "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&q=80"],
  ["Tạ tay điều chỉnh 24kg", "Bộ đôi tạ tay điều chỉnh nhanh từ 5-24kg.", "sports", "Domyos", "SKU-DOM-DUMBBL-24", 2490000, 22, "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80"],
];

async function main() {
  const ping = await fetch(`${GATEWAY}/products?size=100`).catch(() => null);
  if (!ping || !ping.ok) {
    console.error(`gateway not reachable at ${GATEWAY}`);
    process.exit(1);
  }
  const pingBody = await ping.json();
  const currentCount = pingBody?.data?.totalElements ?? pingBody?.data?.content?.length ?? 0;
  const existingBySku = new Map(
    (pingBody?.data?.content ?? []).flatMap((product) =>
      (product.variants ?? []).map((variant) => [variant.sku, { product, variant }]),
    ),
  );
  if (currentCount > 0 && !FORCE) {
    console.log(`catalog already has ${currentCount} products. Set FORCE=1 to seed anyway.`);
    return;
  }

  console.log(`==> requesting token for ${SELLER_USER}`);
  const tokenRes = await fetch(`${GATEWAY}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: SELLER_USER,
      password: SELLER_PASS,
    }),
  });
  if (!tokenRes.ok) {
    console.error(`token request failed: ${tokenRes.status} ${await tokenRes.text()}`);
    process.exit(1);
  }
  const token = (await tokenRes.json())?.data?.accessToken;
  if (!token) {
    console.error("token response did not contain an access token");
    process.exit(1);
  }

  console.log("==> seeding products");
  let ok = 0;
  let fail = 0;
  for (const [name, description, categoryId, brand, sku, priceAmount, stockQuantity, imageUrl] of products) {
    const body = {
      name,
      description,
      categoryId,
      brand,
      variants: [
        {
          sku,
          name: "Default",
          priceAmount,
          priceCurrency: "VND",
          imageUrl,
          stockQuantity,
          parcel: { weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 10 },
        },
      ],
      images: [{ url: imageUrl, alt: name, sortOrder: 0 }],
    };
    const existing = existingBySku.get(sku);
    if (existing) {
      if (!TARGET_BACKFILL_SKUS.has(sku)) {
        continue;
      }
      if (existing.variant.parcel) {
        continue;
      }
      const updateBody = {
        name: existing.product.name,
        description: existing.product.description,
        categoryId: existing.product.categoryId,
        brand: existing.product.brand,
        variants: existing.product.variants.map((variant) => ({
          sku: variant.sku,
          name: variant.name,
          priceAmount: variant.priceAmount,
          priceCurrency: variant.priceCurrency,
          imageUrl: variant.imageUrl,
          stockQuantity: variant.stockQuantity,
          parcel: variant.sku === sku && variant.parcel === null
            ? { weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 10 }
            : variant.parcel,
        })),
        images: existing.product.images,
        tags: existing.product.tags,
      };
      const updateRes = await fetch(`${GATEWAY}/sellers/me/products/${existing.product.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });
      if (!updateRes.ok) {
        console.error(`  ! ${name}: parcel backfill failed: ${updateRes.status} ${await updateRes.text()}`);
        fail++;
        continue;
      }
      console.log(`  ~ ${name} (parcel metadata backfilled)`);
      ok++;
      continue;
    }
    if (currentCount > 0) {
      continue;
    }
    const res = await fetch(`${GATEWAY}/sellers/me/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
      console.error(`  ! ${name}: ${res.status} ${responseText}`);
      fail++;
      continue;
    }

    let created;
    try {
      created = JSON.parse(responseText);
    } catch {
      console.error(`  ! ${name}: create response was not valid JSON`);
      fail++;
      continue;
    }
    const productId = created?.data?.id;
    if (!productId) {
      console.error(`  ! ${name}: create response did not include a product id`);
      fail++;
      continue;
    }

    const publishRes = await fetch(`${GATEWAY}/sellers/me/products/${productId}/publish`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!publishRes.ok) {
      console.error(`  ! ${name}: publish failed: ${publishRes.status} ${await publishRes.text()}`);
      fail++;
      continue;
    }

    console.log(`  + ${name}`);
    ok++;
  }

  const after = await fetch(`${GATEWAY}/products?size=1`).then((r) => r.json());
  const total = after?.data?.totalElements ?? after?.data?.content?.length ?? 0;
  console.log(`==> done. created=${ok} failed=${fail}. catalog now has ${total} products.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
