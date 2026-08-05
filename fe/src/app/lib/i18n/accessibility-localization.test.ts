import en from "./en.json";
import vi from "./vi.json";

import { describe, expect, it } from "vitest";

describe("accessibility localization contracts", () => {
  it("keeps registration terms copy separate from login terms in both locales", () => {
    expect(en.register.termsNotice).toBe(
      "By creating an account you agree to VNShop's Terms of Service and Privacy Policy.",
    );
    expect(en.register.termsNotice).not.toBe(en.login.termsNotice);

    expect(vi.register.termsNotice).toBe(
      "Bằng cách tạo tài khoản, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của VNShop.",
    );
    expect(vi.register.termsNotice).not.toBe(vi.login.termsNotice);
  });

  it("stores canonical gallery and theme toggle accessibility labels in both locales", () => {
    expect(en.product.gallery).toBe("Product media gallery");
    expect(en.nav.switchToDarkMode).toBe("Switch to dark mode");
    expect(en.nav.switchToLightMode).toBe("Switch to light mode");

    expect(vi.product.gallery).toBe("Thư viện phương tiện sản phẩm");
    expect(vi.nav.switchToDarkMode).toBe("Chuyển sang chế độ tối");
    expect(vi.nav.switchToLightMode).toBe("Chuyển sang chế độ sáng");
  });
});
