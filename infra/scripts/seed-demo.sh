#!/usr/bin/env bash
# Seed the local stack with a small demo catalog so the FE has something to render.
#
# Usage:
#   bash infra/scripts/seed-demo.sh           # add demo products
#   FORCE=1 bash infra/scripts/seed-demo.sh   # add even if catalog is non-empty
#
# Auth: uses the gateway's native auth boundary with the seeded `seller1`/`test`
# user. All requests go through the gateway at $GATEWAY.

set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
SELLER_USER="${SELLER_USER:-seller1}"
SELLER_PASS="${SELLER_PASS:-test}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

echo "==> checking gateway"
curl -fsS -o /dev/null "${GATEWAY}/products?size=1" || {
  echo "gateway not reachable at ${GATEWAY}" >&2
  exit 1
}

current_count=$(curl -fsS "${GATEWAY}/products?size=1" | jq -r '.data.totalElements // (.data.content | length) // 0')
if [ "${current_count}" != "0" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "catalog already has ${current_count} products. Set FORCE=1 to seed anyway."
  exit 0
fi

echo "==> requesting token for ${SELLER_USER}"
TOKEN=$(curl -fsS \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${SELLER_USER}\",\"password\":\"${SELLER_PASS}\"}" \
  "${GATEWAY}/auth/login" | jq -r .data.accessToken)

if [ -z "${TOKEN}" ] || [ "${TOKEN}" = "null" ]; then
  echo "failed to obtain access token" >&2
  exit 1
fi

create_product() {
  local name="$1" desc="$2" category="$3" brand="$4" sku="$5" price="$6" stock="$7" image="$8"
  local body
  body=$(jq -n \
    --arg name "${name}" \
    --arg desc "${desc}" \
    --arg cat "${category}" \
    --arg brand "${brand}" \
    --arg sku "${sku}" \
    --arg img "${image}" \
    --argjson price "${price}" \
    --argjson stock "${stock}" \
    '{
      name: $name,
      description: $desc,
      categoryId: $cat,
      brand: $brand,
      variants: [{
        sku: $sku,
        name: "Default",
        priceAmount: $price,
        priceCurrency: "VND",
        imageUrl: $img,
        stockQuantity: $stock,
        parcel: { weightGrams: 1000, lengthCm: 30, widthCm: 20, heightCm: 10 }
      }],
      images: [
        { url: $img, alt: $name, sortOrder: 0 }
      ]
    }')
  curl -fsS -X POST "${GATEWAY}/sellers/me/products" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${body}" >/dev/null
  printf '  + %s\n' "${name}"
}

echo "==> seeding products"

# electronics
create_product "Tai nghe Sony WH-1000XM5" "Chống ồn chủ động, pin 30h, hỗ trợ LDAC."  "electronics" "Sony"   "SKU-SONY-WH-XM5"   8990000  25 "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"
create_product "iPhone 16 Pro Max 256GB"   "Chip A18 Pro, màn hình ProMotion, camera Fusion." "electronics" "Apple"  "SKU-IPH16-PM-256"  31990000  10 "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&q=80"
create_product "MacBook Air M4 13\""        "8GB RAM, 256GB SSD, vỏ nhôm tái chế."             "electronics" "Apple"  "SKU-MBA-M4-13"     27490000   8 "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80"
create_product "Apple Watch Series 10 GPS"  "Màn hình OLED 46mm, đo SpO2, ECG."                "electronics" "Apple"  "SKU-AW-10-46"       9990000  12 "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80"

# fashion
create_product "Áo thun cotton basic"        "100% cotton, vai sườn, form regular fit."         "fashion"     "Coolmate" "SKU-COOL-TEE-BLK"   199000  120 "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80"
create_product "Giày chạy bộ Nike Air Max"   "Đệm Air, upper Flyknit, drop 10mm."               "fashion"     "Nike"     "SKU-NIKE-AM2026"  3290000   30 "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80"
create_product "Đầm hoa nhí mùa hè"          "Vải lụa lạnh, dáng A, có lót."                    "fashion"     "Lily"     "SKU-LILY-DRESS-1"  450000   45 "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80"

# beauty
create_product "Sữa rửa mặt Cerave Foaming"  "Phù hợp da dầu, không hương liệu, tuýp 236ml."    "beauty"      "CeraVe"   "SKU-CERAVE-FC-236" 380000  60 "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80"
create_product "Son Tom Ford Lip Color"      "Vỏ kim loại, màu Ruby Rush, 3g."                  "beauty"      "Tom Ford" "SKU-TF-LIP-RUBY"  1490000  18 "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&q=80"

# home
create_product "Bộ chăn ga gối Cotton 100%"  "King size, cotton TC500, 4 món."                  "home"        "Everon"   "SKU-EVR-BED-K"    1890000  20 "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80"
create_product "Đèn bàn LED cảm ứng"         "Cảm ứng cảm biến, 3 mức sáng, sạc USB-C."         "home"        "Xiaomi"   "SKU-MI-LAMP-1S"    690000  35 "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80"

# sports
create_product "Vợt cầu lông Yonex Astrox 88D" "Cân bằng, đầu nặng, sợi carbon HM."             "sports"      "Yonex"    "SKU-YNX-AX88D"    3990000  15 "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&q=80"
create_product "Tạ tay điều chỉnh 24kg"       "Bộ đôi tạ tay điều chỉnh nhanh từ 5-24kg."       "sports"      "Domyos"   "SKU-DOM-DUMBBL-24" 2490000  22 "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80"

echo "==> done. catalog now has $(curl -fsS "${GATEWAY}/products?size=1" | jq -r '.data.totalElements // (.data.content | length) // 0') products."
