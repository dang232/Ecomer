import { IconCheck, IconCopy, IconChevronRight, IconStar, IconBolt, IconHeart, IconShoppingCart, IconBell, IconSearch, IconPackage, IconTag, IconShield, IconTruck, IconArrowRight, IconTrendingUp, IconEye, IconAlertCircle, IconInfoCircle, IconCircleCheck, IconCircleX, IconPlus, IconMinus, IconX, IconFilter, IconAdjustmentsHorizontal, IconBuildingStore, IconUser, IconHome } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useState } from "react";

import { formatPrice } from "../lib/format";

// ─── Color Token ────────────────────────────────────────────────────────────
interface ColorSwatch {
  name: string;
  hex: string;
  textDark?: boolean;
}

const TEAL_PALETTE: ColorSwatch[] = [
  { name: "Teal 50", hex: "#E6FAF9", textDark: true },
  { name: "Teal 100", hex: "#B3F0ED", textDark: true },
  { name: "Teal 200", hex: "#80E6E2", textDark: true },
  { name: "Teal 300", hex: "#4DDBD6", textDark: true },
  { name: "Teal 400", hex: "#1AD1CA", textDark: true },
  { name: "Teal 500", hex: "var(--primary)" },
  { name: "Teal 600", hex: "#00A89D" },
  { name: "Teal 700", hex: "#009990" },
  { name: "Teal 800", hex: "#007A73" },
  { name: "Teal 900", hex: "#005C57" },
];
const ORANGE_PALETTE: ColorSwatch[] = [
  { name: "Orange 50", hex: "#FFF2EA", textDark: true },
  { name: "Orange 100", hex: "#FFD9BF", textDark: true },
  { name: "Orange 200", hex: "#FFB580", textDark: true },
  { name: "Orange 300", hex: "#FF9240", textDark: true },
  { name: "Orange 400", hex: "#FF7A1A", textDark: true },
  { name: "Orange 500", hex: "#FF6200" },
  { name: "Orange 600", hex: "#E55800" },
  { name: "Orange 700", hex: "#CC4E00" },
  { name: "Orange 800", hex: "#B24400" },
  { name: "Orange 900", hex: "#7F3000" },
];
const NEUTRAL_PALETTE: ColorSwatch[] = [
  { name: "Gray 50", hex: "#F9FAFB", textDark: true },
  { name: "Gray 100", hex: "#F3F4F6", textDark: true },
  { name: "Gray 200", hex: "#E5E7EB", textDark: true },
  { name: "Gray 300", hex: "#D1D5DB", textDark: true },
  { name: "Gray 400", hex: "#9CA3AF", textDark: true },
  { name: "Gray 500", hex: "#6B7280" },
  { name: "Gray 600", hex: "#4B5563" },
  { name: "Gray 700", hex: "#374151" },
  { name: "Gray 800", hex: "#1F2937" },
  { name: "Gray 900", hex: "#111827" },
];
const SEMANTIC_COLORS: ColorSwatch[] = [
  { name: "Success", hex: "#10B981" },
  { name: "Warning", hex: "#F59E0B", textDark: true },
  { name: "Error", hex: "#EF4444" },
  { name: "IconInfoCircle", hex: "#3B82F6" },
];

function SwatchRow({ swatches }: { swatches: ColorSwatch[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1400);
  };
  return (
    <div className="flex gap-1.5 flex-wrap">
      {swatches.map((s) => (
        <button
          key={s.hex}
          onClick={() => copy(s.hex)}
          className="group flex flex-col rounded-xl overflow-hidden shadow-sm hover:scale-105 transition-transform duration-200"
          style={{ width: 80 }}
          title={s.hex}
        >
          <div
            className="h-14 w-full flex items-center justify-center"
            style={{ background: s.hex }}
          >
            <span
              className={`opacity-0 group-hover:opacity-100 transition-opacity ${s.textDark ? "text-gray-800" : "text-white"}`}
            >
              {copied === s.hex ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </span>
          </div>
          <div
            className="px-1.5 py-1.5 bg-white border border-gray-100"
            style={{ fontSize: 10, lineHeight: 1.4 }}
          >
            <div className="font-semibold text-gray-700 truncate">{s.name}</div>
            <div className="text-gray-400 font-mono">{s.hex}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {subtitle ? <p className="text-gray-500 mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{children}</p>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────
function ButtonShowcase() {
  const [loading, setLoading] = useState(false);
  const triggerLoad = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1800);
  };
  return (
    <Card>
      <div className="space-y-8">
        {/* Primary */}
        <div>
          <Label>Primary — Teal</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              className="px-4 py-2 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--primary)" }}
            >
              Mua ngay
            </button>
            <button
              className="px-5 py-2.5 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--primary)" }}
            >
              Thêm vào giỏ
            </button>
            <button
              className="px-6 py-3 rounded-xl text-white font-semibold text-lg transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--primary)" }}
            >
              Thanh toán
            </button>
            <button
              disabled
              className="px-5 py-2.5 rounded-xl text-white font-semibold opacity-40 cursor-not-allowed"
              style={{ background: "var(--primary)" }}
            >
              Disabled
            </button>
            <button
              onClick={triggerLoad}
              className="px-5 py-2.5 rounded-xl text-white font-semibold flex items-center gap-2 transition-all hover:opacity-90"
              style={{ background: "var(--primary)" }}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    color="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Đang xử lý…
                </>
              ) : (
                "Loading State"
              )}
            </button>
          </div>
        </div>
        {/* Orange / CTA */}
        <div>
          <Label>CTA — Orange</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              className="px-4 py-2 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#FF6200" }}
            >
              Flash Sale
            </button>
            <button
              className="px-5 py-2.5 rounded-xl text-white font-semibold transition-all hover:opacity-90 active:scale-95 flex items-center gap-1.5"
              style={{ background: "#FF6200" }}
            >
              <IconBolt size={15} fill="white" /> Mua ngay
            </button>
            <button
              className="px-6 py-3 rounded-xl text-white font-semibold text-lg flex items-center gap-2 transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #FF6200, #FF8C00)" }}
            >
              <IconShoppingCart size={20} /> Đặt hàng
            </button>
          </div>
        </div>
        {/* Outlined */}
        <div>
          <Label>Outlined & Ghost</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              className="px-5 py-2.5 rounded-xl font-semibold border-2 transition-all hover:bg-teal-50"
              style={{ color: "var(--primary)", borderColor: "var(--primary)" }}
            >
              Xem thêm
            </button>
            <button className="px-5 py-2.5 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 transition-all hover:bg-gray-50">
              Lưu nháp
            </button>
            <button className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 transition-all hover:bg-gray-100">
              Hủy bỏ
            </button>
            <button
              className="px-5 py-2.5 rounded-xl font-semibold border-2 transition-all hover:bg-red-50"
              style={{ color: "#EF4444", borderColor: "#EF4444" }}
            >
              IconXóa sản phẩm
            </button>
          </div>
        </div>
        {/* Icon Buttons */}
        <div>
          <Label>Icon Buttons</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90"
              style={{ background: "var(--primary)" }}
            >
              <IconHeart size={18} />
            </button>
            <button className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
              <IconHeart size={18} />
            </button>
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 shadow-lg"
              style={{ background: "#FF6200" }}
            >
              <IconPlus size={20} />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
              <IconMinus size={18} />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
              <IconX size={18} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Typography ───────────────────────────────────────────────────────────────
function TypographyShowcase() {
  return (
    <Card>
      <div className="space-y-6">
        <div>
          <Label>Be Vietnam Pro — Headings</Label>
          <div className="space-y-3" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
            {[
              { size: "text-5xl", label: "48px / Bold", text: "VNShop — Mua sắm thả ga" },
              { size: "text-4xl", label: "36px / Bold", text: "Flash Sale mỗi ngày 12:00" },
              { size: "text-3xl", label: "30px / SemiBold", text: "Sản phẩm nổi bật hôm nay" },
              { size: "text-2xl", label: "24px / SemiBold", text: "Danh mục phổ biến" },
              { size: "text-xl", label: "20px / Medium", text: "Thông tin sản phẩm chi tiết" },
            ].map((t) => (
              <div key={t.label} className="flex items-baseline gap-4">
                <span className="text-gray-300 font-mono w-36 text-xs shrink-0">{t.label}</span>
                <span className={`${t.size} font-bold leading-tight text-gray-900`}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6">
          <Label>Inter — Body & UI</Label>
          <div className="space-y-3">
            {[
              {
                size: "text-lg",
                label: "18px / Regular",
                text: "Chất lượng sản phẩm được kiểm định bởi đội ngũ chuyên gia VNShop.",
              },
              {
                size: "text-base",
                label: "16px / Regular",
                text: "Giao hàng nhanh toàn quốc, hoàn tiền 100% nếu không hài lòng.",
              },
              {
                size: "text-sm",
                label: "14px / Regular",
                text: "Mô tả sản phẩm: Áo thun nam chất liệu cotton 100%, co giãn thoải mái.",
              },
              {
                size: "text-xs",
                label: "12px / Regular",
                text: "Lưu ý: Giá đã bao gồm VAT. Miễn phí vận chuyển cho đơn từ 299.000₫.",
              },
            ].map((t) => (
              <div key={t.label} className="flex items-baseline gap-4">
                <span className="text-gray-300 font-mono w-36 text-xs shrink-0">{t.label}</span>
                <span className={`${t.size} text-gray-700`}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6">
          <Label>Font Weights</Label>
          <div className="flex flex-wrap gap-6">
            {[300, 400, 500, 600, 700, 800].map((w) => (
              <div key={w} className="text-center">
                <div className="text-2xl text-gray-900 mb-1" style={{ fontWeight: w }}>
                  Aa
                </div>
                <div className="text-xs text-gray-400">{w}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Badges & Tags ────────────────────────────────────────────────────────────
function BadgesShowcase() {
  return (
    <Card>
      <div className="space-y-6">
        <div>
          <Label>Product Badges</Label>
          <div className="flex flex-wrap gap-2.5">
            <span
              className="px-2.5 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: "#FF6200" }}
            >
              -30%
            </span>
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: "#E53E3E" }}
            >
              <IconBolt size={10} fill="white" /> Flash Sale
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: "#10B981" }}
            >
              Mới
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: "#8B5CF6" }}
            >
              Độc Quyền
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-white text-xs font-bold"
              style={{ background: "var(--primary)" }}
            >
              Mall
            </span>
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "#FFF3E0", color: "#FF6200" }}
            >
              <IconTruck size={10} /> Miễn ship
            </span>
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "#E6FAF9", color: "var(--primary)" }}
            >
              <IconShield size={10} /> Chính hãng
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              Bán chạy
            </span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6">
          <Label>Status Badges</Label>
          <div className="flex flex-wrap gap-2.5">
            {[
              { label: "Chờ xác nhận", bg: "#FEF3C7", color: "#92400E" },
              { label: "Đã xác nhận", bg: "#DBEAFE", color: "#1E40AF" },
              { label: "Đang vận chuyển", bg: "#E0E7FF", color: "#3730A3" },
              { label: "Đã giao hàng", bg: "#D1FAE5", color: "#065F46" },
              { label: "Đã hủy", bg: "#FEE2E2", color: "#991B1B" },
              { label: "Hoàn tiền", bg: "#F3E8FF", color: "#6B21A8" },
            ].map((s) => (
              <span
                key={s.label}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: s.bg, color: s.color }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6">
          <Label>Notification Pills</Label>
          <div className="flex flex-wrap gap-2.5">
            <span
              className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
              style={{ background: "#EF4444" }}
            >
              3
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-white text-xs font-bold"
              style={{ background: "#EF4444" }}
            >
              12
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-white text-xs font-bold"
              style={{ background: "var(--primary)" }}
            >
              99+
            </span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6">
          <Label>Category Tags</Label>
          <div className="flex flex-wrap gap-2">
            {[
              "Điện thoại",
              "Thời trang",
              "Làm đẹp",
              "Nhà cửa",
              "Thể thao",
              "Đồ chơi",
              "Sách",
              "Thực phẩm",
            ].map((t) => (
              <button
                key={t}
                className="px-3.5 py-1.5 rounded-full text-sm font-medium border border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-all"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Inputs ───────────────────────────────────────────────────────────────────
function InputsShowcase() {
  return (
    <Card>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Label>Input Fields</Label>
          {/* Default */}
          <div>
            <label
              htmlFor="ds-input-name"
              className="text-sm font-medium text-gray-700 block mb-1.5"
            >
              Họ và tên
            </label>
            <input
              id="ds-input-name"
              type="text"
              placeholder="Nguyễn Văn A"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 transition-all"
              style={{ boxShadow: "none" }}
            />
          </div>
          {/* Focused */}
          <div>
            <label
              htmlFor="ds-input-email"
              className="text-sm font-medium text-gray-700 block mb-1.5"
            >
              Email
            </label>
            <input
              id="ds-input-email"
              type="email"
              defaultValue="nguyen@email.com"
              className="w-full px-4 py-2.5 rounded-xl border-2 bg-white text-gray-800"
              style={{ borderColor: "var(--primary)", boxShadow: "0 0 0 3px rgba(0,191,179,0.12)" }}
            />
          </div>
          {/* Error */}
          <div>
            <label
              htmlFor="ds-input-phone"
              className="text-sm font-medium text-gray-700 block mb-1.5"
            >
              Số điện thoại
            </label>
            <input
              id="ds-input-phone"
              type="tel"
              defaultValue="0909abc123"
              className="w-full px-4 py-2.5 rounded-xl border-2 bg-white text-gray-800"
              style={{ borderColor: "#EF4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.1)" }}
            />
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <IconAlertCircle size={12} /> Số điện thoại không hợp lệ
            </p>
          </div>
          {/* Disabled */}
          <div>
            <label
              htmlFor="ds-input-order"
              className="text-sm font-medium text-gray-400 block mb-1.5"
            >
              Mã đơn hàng
            </label>
            <input
              id="ds-input-order"
              type="text"
              value="VNS-20240115-001"
              disabled
              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
        <div className="space-y-4">
          <Label>IconSearch & Select</Label>
          {/* IconSearch input */}
          <div className="relative">
            <IconSearch
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
            />
          </div>
          {/* Select */}
          <div>
            <label
              htmlFor="ds-select-province"
              className="text-sm font-medium text-gray-700 block mb-1.5"
            >
              Tỉnh / Thành phố
            </label>
            <select
              id="ds-select-province"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:border-teal-400 transition-all appearance-none"
            >
              <option>Hồ Chí Minh</option>
              <option>Hà Nội</option>
              <option>Đà Nẵng</option>
            </select>
          </div>
          {/* Textarea */}
          <div>
            <label
              htmlFor="ds-textarea-address"
              className="text-sm font-medium text-gray-700 block mb-1.5"
            >
              Địa chỉ giao hàng
            </label>
            <textarea
              id="ds-textarea-address"
              rows={3}
              placeholder="Số nhà, tên đường, phường/xã..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-400 transition-all resize-none"
            />
          </div>
          {/* Checkbox & Radio */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-teal-500" />
              <span className="text-sm text-gray-700">Miễn phí vận chuyển</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name="r" defaultChecked className="w-4 h-4 accent-teal-500" />
              <span className="text-sm text-gray-700">Giao hàng tiêu chuẩn (2-3 ngày)</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name="r" className="w-4 h-4 accent-teal-500" />
              <span className="text-sm text-gray-700">Giao hàng nhanh (1 ngày)</span>
            </label>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function CardsShowcase() {
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {/* Product Card */}
      <div>
        <Label>Product Card</Label>
        <div className="group rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 bg-white">
          <div className="relative overflow-hidden" style={{ aspectRatio: "1" }}>
            <div className="w-full h-full bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
              <IconPackage size={48} className="text-teal-300" />
            </div>
            <span
              className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-white text-xs font-bold"
              style={{ background: "#FF6200" }}
            >
              -25%
            </span>
            <span
              className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "#FFF3E0", color: "#FF6200" }}
            >
              <IconTruck size={9} /> Free
            </span>
          </div>
          <div className="p-3.5">
            <p className="text-xs text-gray-400 mb-0.5">TechStore Official</p>
            <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug mb-2">
              Tai nghe Bluetooth Sony WH-1000XM5 chống ồn chủ động
            </p>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <IconStar
                  key={i}
                  size={11}
                  fill={i <= 4 ? "#FF6200" : "none"}
                  stroke={i <= 4 ? "#FF6200" : "#D1D5DB"}
                />
              ))}
              <span className="text-xs text-gray-400 ml-0.5">(1.2k)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: "#FF6200" }}>
                {formatPrice(5990000)}
              </span>
              <span className="text-xs text-gray-400 line-through">{formatPrice(7990000)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seller Card */}
      <div>
        <Label>Seller Card</Label>
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all">
          <div
            className="h-20 flex items-end px-4 pb-2"
            style={{ background: "linear-gradient(135deg, #E6FAF9, #B3F0ED)" }}
          >
            <div
              className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center mb-1"
              style={{ border: "2px solid var(--primary)" }}
            >
              <IconBuildingStore size={24} style={{ color: "var(--primary)" }} />
            </div>
          </div>
          <div className="px-4 pt-2 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900">TechStore Việt Nam</h4>
              <span
                className="px-1.5 py-0.5 rounded-md text-xs font-bold text-white"
                style={{ background: "var(--primary)" }}
              >
                Mall
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-0.5">
                <IconStar size={10} fill="#FF6200" color="#FF6200" /> 4.9
              </span>
              <span>12.5k sản phẩm</span>
              <span>98% phản hồi</span>
            </div>
            <button
              className="w-full py-2 rounded-xl text-sm font-semibold border-2 transition-all hover:bg-teal-50"
              style={{ color: "var(--primary)", borderColor: "var(--primary)" }}
            >
              Xem Shop
            </button>
          </div>
        </div>
      </div>

      {/* Review Card */}
      <div>
        <Label>Review Card</Label>
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), #009990)" }}
            >
              N
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-800">Nguyễn Thị Mai</span>
                <span className="text-xs text-gray-400">2 ngày trước</span>
              </div>
              <div className="flex items-center gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <IconStar key={i} size={11} fill="#FF6200" color="#FF6200" />
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Sản phẩm chất lượng tốt, giao hàng nhanh. Đóng gói cẩn thận, rất hài lòng!
              </p>
              <div className="flex items-center gap-3 mt-2.5">
                <button className="text-xs text-gray-400 flex items-center gap-1 hover:text-teal-600 transition-colors">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    color="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  Hữu ích (24)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
function AlertsShowcase() {
  return (
    <Card>
      <div className="space-y-3">
        {[
          {
            icon: IconCircleCheck,
            bg: "#D1FAE5",
            border: "#6EE7B7",
            text: "#065F46",
            label: "Đặt hàng thành công!",
            desc: "Đơn hàng VNS-20240115-001 đã được xác nhận. Dự kiến giao trong 2-3 ngày.",
          },
          {
            icon: IconInfoCircle,
            bg: "#DBEAFE",
            border: "#93C5FD",
            text: "#1E40AF",
            label: "Khuyến mãi sắp hết!",
            desc: "Flash Sale kết thúc sau 02:30:15. Mua ngay để hưởng ưu đãi -50%.",
          },
          {
            icon: IconAlertCircle,
            bg: "#FEF3C7",
            border: "#FCD34D",
            text: "#92400E",
            label: "Sắp hết hàng",
            desc: "Chỉ còn 5 sản phẩm trong kho. Đặt ngay để không bỏ lỡ!",
          },
          {
            icon: IconCircleX,
            bg: "#FEE2E2",
            border: "#FCA5A5",
            text: "#991B1B",
            label: "Thanh toán thất bại",
            desc: "Giao dịch bị từ chối. Vui lòng kiểm tra thông tin thẻ và thử lại.",
          },
        ].map(({ icon: Icon, bg, border, text, label, desc }) => (
          <div
            key={label}
            className="flex gap-3 p-4 rounded-xl"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <Icon size={18} style={{ color: text }} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm" style={{ color: text }}>
                {label}
              </p>
              <p className="text-sm mt-0.5" style={{ color: text, opacity: 0.8 }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Spacing & Shadows ────────────────────────────────────────────────────────
function SpacingShowcase() {
  const steps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
  return (
    <Card>
      <Label>8pt Grid — Spacing Scale</Label>
      <div className="flex flex-wrap items-end gap-3">
        {steps.map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <div
              className="rounded"
              style={{
                width: s * 4,
                height: s * 4,
                minWidth: 4,
                minHeight: 4,
                background: "var(--primary)",
                opacity: 0.6 + s * 0.015,
              }}
            />
            <span className="text-xs font-mono text-gray-400">{s * 4}px</span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 mt-6 pt-6">
        <Label>Shadow Scale</Label>
        <div className="flex flex-wrap gap-5">
          {[
            { label: "sm", shadow: "0 1px 3px rgba(0,0,0,0.08)" },
            { label: "md", shadow: "0 4px 12px rgba(0,0,0,0.1)" },
            { label: "lg", shadow: "0 8px 24px rgba(0,0,0,0.12)" },
            { label: "xl", shadow: "0 16px 40px rgba(0,0,0,0.14)" },
            { label: "2xl", shadow: "0 24px 64px rgba(0,0,0,0.16)" },
            { label: "teal", shadow: "0 8px 24px rgba(0,191,179,0.3)" },
            { label: "orange", shadow: "0 8px 24px rgba(255,98,0,0.3)" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-xl bg-white" style={{ boxShadow: s.shadow }} />
              <span className="text-xs font-mono text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 mt-6 pt-6">
        <Label>Border Radius Scale</Label>
        <div className="flex flex-wrap gap-5 items-end">
          {[
            { label: "sm", r: "6px" },
            { label: "md", r: "8px" },
            { label: "lg", r: "12px" },
            { label: "xl", r: "16px" },
            { label: "2xl", r: "20px" },
            { label: "3xl", r: "24px" },
            { label: "full", r: "9999px" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <div
                className="w-14 h-14 border-2 border-teal-300 bg-teal-50"
                style={{ borderRadius: s.r }}
              />
              <span className="text-xs font-mono text-gray-400">{s.label}</span>
              <span className="text-xs text-gray-300">{s.r}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Icons Reference ──────────────────────────────────────────────────────────
const ICON_SET = [
  { icon: IconSearch, name: "IconSearch" },
  { icon: IconShoppingCart, name: "Cart" },
  { icon: IconHeart, name: "IconHeart" },
  { icon: IconBell, name: "IconBell" },
  { icon: IconStar, name: "IconStar" },
  { icon: IconBolt, name: "IconBolt" },
  { icon: IconTruck, name: "IconTruck" },
  { icon: IconShield, name: "IconShield" },
  { icon: IconPackage, name: "IconPackage" },
  { icon: IconTag, name: "IconTag" },
  { icon: IconBuildingStore, name: "IconBuildingStore" },
  { icon: IconUser, name: "IconUser" },
  { icon: IconTrendingUp, name: "Trending" },
  { icon: IconEye, name: "IconEye" },
  { icon: IconFilter, name: "IconFilter" },
  { icon: IconAdjustmentsHorizontal, name: "Sliders" },
  { icon: IconPlus, name: "IconPlus" },
  { icon: IconX, name: "IconX" },
  { icon: IconCheck, name: "IconCheck" },
  { icon: IconArrowRight, name: "Arrow" },
  { icon: IconChevronRight, name: "Chevron" },
  { icon: IconInfoCircle, name: "IconInfoCircle" },
  { icon: IconAlertCircle, name: "Alert" },
  { icon: IconCircleCheck, name: "Success" },
];

function IconsShowcase() {
  return (
    <Card>
      <Label>Lucide Icons — Used in VNShop</Label>
      <div className="flex flex-wrap gap-3">
        {ICON_SET.map(({ icon: Icon, name }) => (
          <div
            key={name}
            className="flex flex-col items-center gap-1.5 w-16 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-default"
          >
            <Icon size={20} className="text-gray-600" />
            <span className="text-xs text-gray-400 text-center leading-tight">{name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Navigation Component Demo ────────────────────────────────────────────────
function NavigationDemo() {
  const [active, setActive] = useState("home");
  return (
    <Card>
      <Label>Bottom Tab Bar (Mobile)</Label>
      <div className="max-w-sm mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
            <p className="text-teal-400 text-sm">Page Content</p>
          </div>
          <div className="flex border-t border-gray-100 px-2 py-2">
            {[
              { id: "home", icon: IconHome, label: "Trang chủ" },
              { id: "search", icon: IconSearch, label: "Tìm kiếm" },
              { id: "cart", icon: IconShoppingCart, label: "Giỏ hàng", badge: 3 },
              { id: "profile", icon: IconUser, label: "Tài khoản" },
            ].map(({ id, icon: Icon, label, badge }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className="flex-1 flex flex-col items-center py-1 gap-0.5 rounded-xl transition-all"
                style={{ background: active === id ? "rgba(0,191,179,0.1)" : "transparent" }}
              >
                <div className="relative">
                  <Icon size={20} style={{ color: active === id ? "var(--primary)" : "#9CA3AF" }} />
                  {badge ? (
                    <span
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold"
                      style={{ background: "#FF6200", fontSize: 9 }}
                    >
                      {badge}
                    </span>
                  ) : null}
                </div>
                <span
                  className="text-xs"
                  style={{
                    color: active === id ? "var(--primary)" : "#9CA3AF",
                    fontWeight: active === id ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Gradient & Glass ─────────────────────────────────────────────────────────
function GradientsShowcase() {
  const gradients = [
    { name: "Brand Teal", css: "linear-gradient(135deg, var(--primary), #009990)" },
    { name: "Brand Orange", css: "linear-gradient(135deg, #FF6200, #FF8C00)" },
    { name: "Hero Dark", css: "linear-gradient(135deg, #0F172A, #1E293B)" },
    { name: "Sunset", css: "linear-gradient(135deg, #FF6200, var(--primary))" },
    { name: "Teal Soft", css: "linear-gradient(135deg, #E6FAF9, #B3F0ED)" },
    { name: "Orange Soft", css: "linear-gradient(135deg, #FFF2EA, #FFD9BF)" },
  ];
  return (
    <Card>
      <div className="space-y-6">
        <div>
          <Label>Brand Gradients</Label>
          <div className="flex flex-wrap gap-4">
            {gradients.map((g) => (
              <div key={g.name} className="text-center">
                <div
                  className="w-28 h-20 rounded-xl shadow-sm mb-1.5"
                  style={{ background: g.css }}
                />
                <p className="text-xs text-gray-500">{g.name}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6">
          <Label>Glassmorphism</Label>
          <div className="flex gap-4">
            <div
              className="w-48 h-28 rounded-2xl p-4 flex flex-col justify-between"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                backgroundImage: "linear-gradient(135deg, var(--primary), #009990)",
              }}
            >
              <span className="text-white/70 text-xs">Ví VNShop</span>
              <div>
                <p className="text-white font-bold text-xl">{formatPrice(2500000)}</p>
                <p className="text-white/60 text-xs">Khả dụng</p>
              </div>
            </div>
            <div
              className="w-48 h-28 rounded-2xl p-4 flex flex-col justify-between"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 8px 32px rgba(255,98,0,0.2)",
                backgroundImage: "linear-gradient(135deg, #FF6200, #FF8C00)",
              }}
            >
              <span className="text-white/70 text-xs">Flash Sale</span>
              <div>
                <p className="text-white font-bold text-xl">02:30:15</p>
                <p className="text-white/60 text-xs">Kết thúc sau</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function DesignSystemPage() {
  const sections = [
    "Màu sắc",
    "Chữ",
    "Nút bấm",
    "Badge & IconTag",
    "Form & Input",
    "Card",
    "Alert",
    "Khoảng cách",
    "Icon",
    "Navigation",
    "Gradient",
  ];
  const [active, setActive] = useState("Màu sắc");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--primary), #009990)" }}
            >
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
              >
                VNShop Design System
              </h1>
              <p className="text-xs text-gray-400">Hệ thống thiết kế • v1.0 • Tailwind CSS v4</p>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-px">
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setActive(s)}
                className="px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all"
                style={{
                  background: active === s ? "var(--primary)" : "transparent",
                  color: active === s ? "#fff" : "#6B7280",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {active === "Màu sắc" ? (
            <Section
              title="Hệ thống màu sắc"
              subtitle="Bảng màu thương hiệu VNShop dựa trên màu chủ đạo Teal var(--primary) và cam #FF6200"
            >
              <div className="space-y-6">
                <Card>
                  <Label>Brand Primary — Teal</Label>
                  <SwatchRow swatches={TEAL_PALETTE} />
                </Card>
                <Card>
                  <Label>Brand Accent — Orange</Label>
                  <SwatchRow swatches={ORANGE_PALETTE} />
                </Card>
                <Card>
                  <Label>Neutral — Gray</Label>
                  <SwatchRow swatches={NEUTRAL_PALETTE} />
                </Card>
                <Card>
                  <Label>Semantic Colors</Label>
                  <SwatchRow swatches={SEMANTIC_COLORS} />
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      Các màu ngữ nghĩa được dùng nhất quán trong toàn bộ hệ thống:{" "}
                      <span className="font-medium text-green-600">Success</span> cho trạng thái
                      thành công, <span className="font-medium text-yellow-600">Warning</span> cho
                      cảnh báo, <span className="font-medium text-red-500">Error</span> cho lỗi và
                      xóa, <span className="font-medium text-blue-500">IconInfoCircle</span> cho thông tin.
                    </p>
                  </div>
                </Card>
              </div>
            </Section>
          ) : null}
          {active === "Chữ" ? (
            <Section title="Kiểu chữ" subtitle="Inter cho UI text, Be Vietnam Pro cho tiêu đề">
              <TypographyShowcase />
            </Section>
          ) : null}
          {active === "Nút bấm" ? (
            <Section title="Buttons" subtitle="Tất cả variants và trạng thái của button components">
              <ButtonShowcase />
            </Section>
          ) : null}
          {active === "Badge & IconTag" ? (
            <Section
              title="Badges & Tags"
              subtitle="Nhãn trạng thái, khuyến mãi, danh mục và thông báo"
            >
              <BadgesShowcase />
            </Section>
          ) : null}
          {active === "Form & Input" ? (
            <Section title="Form & Input" subtitle="Các trường nhập liệu với đầy đủ trạng thái">
              <InputsShowcase />
            </Section>
          ) : null}
          {active === "Card" ? (
            <Section title="Cards" subtitle="Product card, seller card và review card">
              <CardsShowcase />
            </Section>
          ) : null}
          {active === "Alert" ? (
            <Section title="Alerts & Notifications" subtitle="Thông báo hệ thống theo ngữ cảnh">
              <AlertsShowcase />
            </Section>
          ) : null}
          {active === "Khoảng cách" ? (
            <Section
              title="Spacing & Radius & Shadow"
              subtitle="Hệ thống 8pt grid, shadow và border-radius"
            >
              <SpacingShowcase />
            </Section>
          ) : null}
          {active === "Icon" ? (
            <Section title="Icons" subtitle="Bộ icon Lucide được sử dụng trong VNShop">
              <IconsShowcase />
            </Section>
          ) : null}
          {active === "Navigation" ? (
            <Section title="Navigation" subtitle="Tab bar mobile và navigation patterns">
              <NavigationDemo />
            </Section>
          ) : null}
          {active === "Gradient" ? (
            <Section
              title="Gradients & Glassmorphism"
              subtitle="Gradient thương hiệu và hiệu ứng kính"
            >
              <GradientsShowcase />
            </Section>
          ) : null}
        </motion.div>

        {/* Tokens Reference */}
        <Card className="mt-10">
          <Label>Design Tokens Reference</Label>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { token: "--primary", value: "var(--primary)", desc: "Brand primary" },
              { token: "--vn-orange", value: "#FF6200", desc: "Brand accent" },
              { token: "--vn-teal-dark", value: "#009990", desc: "Hover/active" },
              { token: "--vn-orange-dark", value: "#E05500", desc: "Orange hover" },
              { token: "--background", value: "#ffffff", desc: "Page background" },
              { token: "--foreground", value: "#0a0a0a", desc: "Default text" },
              { token: "--muted", value: "#ececf0", desc: "Subtle bg" },
              { token: "--border", value: "rgba(0,0,0,0.1)", desc: "Default border" },
              { token: "--radius", value: "0.625rem", desc: "Base radius" },
            ].map((t) => (
              <div key={t.token} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div
                  className="w-8 h-8 rounded-lg shrink-0 border border-gray-200"
                  style={{
                    background:
                      t.value.startsWith("#") || t.value.startsWith("rgba") ? t.value : "#f3f4f6",
                  }}
                />
                <div>
                  <p className="font-mono text-xs font-semibold text-gray-700">{t.token}</p>
                  <p className="font-mono text-xs text-gray-400">{t.value}</p>
                  <p className="text-xs text-gray-400">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Fix missing import
function Sparkles(props: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      color="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}
