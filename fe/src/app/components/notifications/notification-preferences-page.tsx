import { IconBell, IconBellCog, IconBellOff, IconMail } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { useNotificationPreferences } from "../../hooks/use-notification-preferences";

const NOTIFICATION_PREFERENCE_SKELETON_IDS = [
  "notification-preference-skeleton-1",
  "notification-preference-skeleton-2",
  "notification-preference-skeleton-3",
  "notification-preference-skeleton-4",
  "notification-preference-skeleton-5",
  "notification-preference-skeleton-6",
];
import type { TypePreference, NotificationChannel } from "../../types/api/notification-preferences";

const NOTIFICATION_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  ORDER_CREATED: { label: "Đơn hàng mới", description: "Khi đơn hàng được tạo thành công" },
  ORDER_CANCELLED: { label: "Đơn hàng bị hủy", description: "Khi đơn hàng bị hủy" },
  ORDER_SHIPPED: { label: "Đã giao cho vận chuyển", description: "Khi đơn hàng được gửi đi" },
  ORDER_DELIVERED: { label: "Đã giao hàng", description: "Khi đơn hàng giao thành công" },
  PAYMENT_COMPLETED: {
    label: "Thanh toán thành công",
    description: "Khi thanh toán được xác nhận",
  },
  PAYMENT_REFUNDED: { label: "Hoàn tiền", description: "Khi đơn hàng được hoàn tiền" },
  SELLER_NEW_ORDER: {
    label: "Đơn hàng mới (Seller)",
    description: "Khi có đơn hàng mới cần xử lý",
  },
  PRODUCT_APPROVED: { label: "Sản phẩm được duyệt", description: "Khi sản phẩm được admin duyệt" },
  PRODUCT_REJECTED: { label: "Sản phẩm bị từ chối", description: "Khi sản phẩm bị từ chối" },
  REVIEW_REPLIED: {
    label: "Phản hồi đánh giá",
    description: "Khi có phản hồi cho đánh giá của bạn",
  },
  RETURN_REQUESTED: { label: "Yêu cầu trả hàng", description: "Khi có yêu cầu trả hàng" },
  PAYOUT_COMPLETED: { label: "Rút tiền thành công", description: "Khi lệnh rút tiền hoàn tất" },
};

const CHANNELS: { key: NotificationChannel; label: string; icon: typeof IconBell }[] = [
  { key: "IN_APP", label: "Trong ứng dụng", icon: IconBell },
  { key: "EMAIL", label: "Email", icon: IconMail },
];

export function NotificationPreferencesPage() {
  const { preferences, isLoading, update, isUpdating } = useNotificationPreferences();
  const [localPrefs, setLocalPrefs] = useState<TypePreference[]>([]);
  const [muted, setMuted] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences.typePreferences);
      setMuted(preferences.muted);
      setDirty(false);
    }
  }, [preferences]);

  const toggleChannel = (type: string, channel: NotificationChannel) => {
    setLocalPrefs((prev) => {
      const existing = prev.find((p) => p.type === type);
      if (!existing) {
        // Type not in prefs yet — add with this channel toggled off (was default on)
        return [
          ...prev,
          { type, channels: CHANNELS.map((c) => c.key).filter((c) => c !== channel) },
        ];
      }
      const hasChannel = existing.channels.includes(channel);
      const newChannels = hasChannel
        ? existing.channels.filter((c) => c !== channel)
        : [...existing.channels, channel];
      return prev.map((p) => (p.type === type ? { ...p, channels: newChannels } : p));
    });
    setDirty(true);
  };

  const isChannelEnabled = (type: string, channel: NotificationChannel): boolean => {
    const pref = localPrefs.find((p) => p.type === type);
    if (!pref) return true; // Default: all enabled
    return pref.channels.includes(channel);
  };

  const handleSave = () => {
    update({ muted, typePreferences: localPrefs });
    setDirty(false);
  };

  const handleToggleMute = () => {
    setMuted((prev) => !prev);
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-64" />
          {NOTIFICATION_PREFERENCE_SKELETON_IDS.map((id) => (
            <div key={id} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <IconBellCog size={24} className="text-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Cài đặt thông báo</h1>
        </div>
        {dirty ? (
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        ) : null}
      </div>

      {/* Global mute toggle */}
      <div className="mb-6 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {muted ? (
              <IconBellOff size={20} className="text-muted-foreground" />
            ) : (
              <IconBell size={20} className="text-foreground" />
            )}
            <div>
              <p className="font-medium text-foreground">
                {muted ? "Tắt tất cả thông báo" : "Thông báo đang bật"}
              </p>
              <p className="text-sm text-muted-foreground">
                {muted
                  ? "Bạn sẽ không nhận bất kỳ thông báo nào"
                  : "Tùy chỉnh từng loại thông báo bên dưới"}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleMute}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              !muted ? "bg-[var(--primary)]" : "bg-muted"
            }`}
            role="switch"
            aria-checked={!muted}
            aria-label="Bật/tắt thông báo"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                !muted ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Per-type preferences */}
      <div className={`space-y-2 ${muted ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Column headers */}
        <div className="flex items-center justify-end gap-4 px-4 pb-2 border-b border-border">
          {CHANNELS.map((ch) => (
            <div key={ch.key} className="flex items-center gap-1 w-24 justify-center">
              <ch.icon size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{ch.label}</span>
            </div>
          ))}
        </div>

        {/* Type rows */}
        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, { label, description }]) => (
          <div
            key={type}
            className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
            <div className="flex items-center gap-4">
              {CHANNELS.map((ch) => (
                <div key={ch.key} className="w-24 flex justify-center">
                  <button
                    onClick={() => toggleChannel(type, ch.key)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isChannelEnabled(type, ch.key) ? "bg-[var(--primary)]" : "bg-muted"
                    }`}
                    role="switch"
                    aria-checked={isChannelEnabled(type, ch.key)}
                    aria-label={`${label} — ${ch.label}`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        isChannelEnabled(type, ch.key) ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
