# VNShop Mobile Phase 1 Manual QA

Date: 2026-07-08

Scope: initial Flutter shell under `vnshop_mobile`, using the Flutter web build as a render smoke test until Android SDK tooling is available.

| Scenario | Evidence | Result |
| --- | --- | --- |
| Desktop home renders with VNShop title and three navigation rows | `desktop-home.png` | Pass |
| Mobile home renders without text clipping or overlap | `mobile-home.png` | Pass |
| Vietnamese labels render with diacritics: Sản phẩm, Giỏ hàng, Thanh toán | `mobile-home.png`, `desktop-home.png` | Pass |
| Cart row navigates to cart placeholder on desktop | `visual-route-console.json`, `desktop-cart.png` | Pass |
| Cart row navigates to cart placeholder on mobile | `visual-route-console.json`, `mobile-cart.png` | Pass |
| Browser console has no errors during smoke route checks | `visual-route-console.json` | Pass |
| Android debug APK build | `flutter-build-apk-debug.txt` | Blocked: Android SDK not found |

