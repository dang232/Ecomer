import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  User,
  MapPin,
  Shield,
  CreditCard,
  Camera,
  Pencil,
  Plus,
  Trash2,
  LogOut,
  AlertCircle,
  Save,
  Store,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { AccountNav } from "@/features/account";
import { useAuth } from "../hooks/auth-context";
import { avatarUploadErrorMessage, useAvatarUpload } from "../hooks/use-avatar-upload";
import { profileOptions } from "../hooks/use-profile";
import { addressKey } from "@/shared/lib";
import { ApiError } from "@/shared/api";
import {
  updateProfile,
  addAddress,
  setDefaultAddress,
  removeAddress,
} from "@/shared/api/endpoints/users";
import type { Address, UserProfile } from "@/shared/contracts/api";

type ProfileTab = "info" | "addresses" | "payment" | "security";

const EMPTY_ADDRESS: Address = {
  street: "",
  ward: "",
  district: "",
  city: "",
  phone: "",
  isDefault: false,
};

function formatAddressLine(a: Address): string {
  return [a.street, a.ward, a.district, a.city].filter(Boolean).join(", ");
}

export function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { authenticated, ready, profile: kcProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("info");
  const { t } = useTranslation();

  const profileQuery = useSuspenseQuery(profileOptions());

  const profile = profileQuery.data;
  const addresses: Address[] = profile?.addresses ?? [];

  // Avatar upload — hidden file input + camera button. The hook handles
  // sha256, presigned PUT, and activate; we just translate result to toast.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarUpload = useAvatarUpload({
    onSuccess: () => {
      toast.success(t("profile.avatar.uploadOk"));
    },
    onError: (err) => {
      toast.error(avatarUploadErrorMessage(err, t));
    },
  });
  const onAvatarFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset input so picking the same file twice still triggers onChange.
    event.target.value = "";
    if (!file) return;
    avatarUpload.mutate(file);
  };
  const avatarUrl = profile?.avatar;

  // Server-derived defaults for the info tab. We never mirror these into local
  // state; instead the form re-mounts with `key` whenever the user enters edit
  // mode, taking these values as its initial draft.
  const serverDefaults = useMemo(() => {
    if (profile) {
      return {
        name: profile.name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
      };
    }
    if (kcProfile) {
      const fullName = [kcProfile.firstName, kcProfile.lastName].filter(Boolean).join(" ").trim();
      return {
        name: fullName || kcProfile.username || "",
        email: kcProfile.email ?? "",
        phone: "",
      };
    }
    return { name: "", email: "", phone: "" };
  }, [profile, kcProfile]);

  // Info tab form state
  const [editing, setEditing] = useState(false);
  const [formDraft, setFormDraft] = useState(serverDefaults);
  // Display values come from the draft while editing, otherwise from the server.
  const formData = editing ? formDraft : serverDefaults;
  const setFormData = (updater: (prev: typeof formDraft) => typeof formDraft) =>
    setFormDraft(updater);

  const beginEditing = () => {
    setFormDraft(serverDefaults);
    setEditing(true);
  };
  const cancelEditing = () => setEditing(false);

  const updateProfileMutation = useMutation({
    mutationFn: () => updateProfile({ name: formData.name, phone: formData.phone }),
    onSuccess: (next) => {
      qc.setQueryData(["users", "me"], next);
      toast.success(t("profile.info.updatedOk"));
      setEditing(false);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("profile.info.updatedErr")),
  });

  // Address state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState<Address>(EMPTY_ADDRESS);

  const addAddressMutation = useMutation({
    mutationFn: (body: Address) => addAddress(body),
    onSuccess: (next) => {
      // The address endpoints return the full up-to-date profile, so we use it
      // as-is. Falling back to a `prev ? merge : prev` pattern would silently
      // drop the response when the cache is empty (first address, cache miss,
      // or a mid-flight invalidation).
      qc.setQueryData<UserProfile>(["users", "me"], (prev) =>
        prev ? { ...prev, addresses: next.addresses ?? [] } : next,
      );
      toast.success(t("profile.addresses.addedOk"));
      setShowAddForm(false);
      setNewAddress(EMPTY_ADDRESS);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("profile.addresses.addedErr")),
  });

  // Spec U-9: pass the stable key (not array index). The API takes both
  // the key and the current address list so it can resolve the index
  // against the live data right before the request.
  const setDefaultMutation = useMutation({
    mutationFn: (key: string) => {
      const fresh = qc.getQueryData<UserProfile>(["users", "me"])?.addresses ?? [];
      return setDefaultAddress(key, fresh);
    },
    onSuccess: (next) => {
      qc.setQueryData<UserProfile>(["users", "me"], (prev) =>
        prev ? { ...prev, addresses: next.addresses ?? [] } : next,
      );
      toast.success(t("profile.addresses.defaultedOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("profile.addresses.updateErr")),
  });

  const removeAddressMutation = useMutation({
    mutationFn: (key: string) => {
      const fresh = qc.getQueryData<UserProfile>(["users", "me"])?.addresses ?? [];
      return removeAddress(key, fresh);
    },
    onSuccess: (next) => {
      qc.setQueryData<UserProfile>(["users", "me"], (prev) =>
        prev ? { ...prev, addresses: next.addresses ?? [] } : next,
      );
      toast.success(t("profile.addresses.removedOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("profile.addresses.removeErr")),
  });

  if (!ready) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-sm text-muted-foreground">
        {t("profile.initSession")}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-muted-foreground mb-3">
          {t("profile.loginRequired")}
        </h2>
        <button
          onClick={() => navigate("/login?next=%2Fprofile")}
          className="px-6 py-2.5 rounded-[var(--radius-md)] bg-primary text-white font-medium"
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  const displayName =
    profile?.name ||
    [kcProfile?.firstName, kcProfile?.lastName].filter(Boolean).join(" ").trim() ||
    kcProfile?.username ||
    t("profile.displayNameFallback");
  const displayEmail = profile?.email ?? kcProfile?.email ?? "";

  const NAV_ITEMS: { id: ProfileTab; labelKey: string; icon: typeof User }[] = [
    { id: "info", labelKey: "profile.tabs.info", icon: User },
    { id: "addresses", labelKey: "profile.tabs.addresses", icon: MapPin },
    { id: "payment", labelKey: "profile.tabs.payment", icon: CreditCard },
    { id: "security", labelKey: "profile.tabs.security", icon: Shield },
  ];

  return (
    <div className="max-w-[1100px] mx-auto py-8 px-8">
      <AccountNav />
      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Left sidebar */}
        <div className="bg-card border border-border rounded-[var(--radius-xl)] p-6 h-fit">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative mb-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center text-primary text-[28px] font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onAvatarFilePick}
                aria-label={t("profile.avatar.uploadCta")}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUpload.isPending}
                aria-label={
                  avatarUpload.isPending
                    ? t("profile.avatar.uploading")
                    : t("profile.avatar.uploadCta")
                }
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow disabled:opacity-50"
              >
                <Camera size={13} color="white" />
              </button>
            </div>
            <h2 className="font-bold text-base text-foreground text-center">{displayName}</h2>
            <p className="text-xs text-muted-foreground text-center mt-0.5">{displayEmail}</p>
          </div>

          {/* Nav items */}
          <div
            role="tablist"
            aria-label={t("profile.sectionsLabel")}
            className="flex flex-col gap-0.5 mt-5"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`profile-tab-${item.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`profile-tabpanel-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium cursor-pointer transition-colors w-full text-left ${
                    isActive
                      ? "bg-primary-light text-primary"
                      : "text-text-secondary hover:bg-background hover:text-foreground"
                  }`}
                >
                  <item.icon size={16} />
                  {t(item.labelKey)}
                </button>
              );
            })}
            {/* Become a Seller */}
            <button
              onClick={() => navigate("/seller/register")}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium cursor-pointer transition-colors w-full text-left text-text-secondary hover:bg-background hover:text-foreground"
            >
              <Store size={16} />
              {t("profile.becomeSeller")}
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={() => logout()}
            className="w-full mt-4 py-2.5 rounded-[var(--radius-md)] text-red-500 border border-red-200 flex items-center justify-center gap-2 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} /> {t("profile.logout")}
          </button>
        </div>

        {/* Right content */}
        <div
          id={`profile-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`profile-tab-${activeTab}`}
          className="bg-card border border-border rounded-[var(--radius-xl)] p-8"
        >
          {activeTab === "info" ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground">{t("profile.info.title")}</h2>
                {editing ? (
                  <div className="flex gap-3">
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium border border-border text-muted-foreground"
                    >
                      {t("profile.info.cancel")}
                    </button>
                    <button
                      onClick={() => updateProfileMutation.mutate()}
                      disabled={updateProfileMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white disabled:opacity-50"
                    >
                      <Save size={14} />
                      {updateProfileMutation.isPending
                        ? t("profile.info.saving")
                        : t("profile.info.save")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={beginEditing}
                    className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium border border-border text-text-secondary hover:bg-background"
                  >
                    <Pencil size={14} /> {t("profile.info.edit")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                {(
                  [
                    {
                      labelKey: "profile.info.fields.name",
                      key: "name" as const,
                      type: "text",
                      editable: true,
                    },
                    {
                      labelKey: "profile.info.fields.email",
                      key: "email" as const,
                      type: "email",
                      editable: false,
                    },
                    {
                      labelKey: "profile.info.fields.phone",
                      key: "phone" as const,
                      type: "tel",
                      editable: true,
                    },
                  ] as const
                ).map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      {t(field.labelKey)}
                    </label>
                    {editing && field.editable ? (
                      <input
                        type={field.type}
                        value={formData[field.key]}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full px-4 py-3 border border-border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary transition-colors"
                      />
                    ) : (
                      <div className="px-4 py-3 rounded-[var(--radius-md)] text-sm text-foreground bg-background border border-border">
                        {formData[field.key] || (
                          <span className="text-muted-foreground">{t("profile.info.notSet")}</span>
                        )}
                      </div>
                    )}
                    {field.key === "email" ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("profile.info.emailHint")}
                      </p>
                    ) : null}
                  </div>
                ))}
                <div className="col-span-2 flex gap-3 justify-end mt-3">
                  {editing ? (
                    <>
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium border border-border text-muted-foreground"
                      >
                        {t("profile.info.cancel")}
                      </button>
                      <button
                        onClick={() => updateProfileMutation.mutate()}
                        disabled={updateProfileMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white disabled:opacity-50"
                      >
                        <Save size={14} />
                        {updateProfileMutation.isPending
                          ? t("profile.info.saving")
                          : t("profile.info.save")}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "addresses" ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground">
                  {t("profile.addresses.title")}
                </h2>
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium bg-primary text-white"
                >
                  <Plus size={14} />{" "}
                  {showAddForm
                    ? t("profile.addresses.addToggleClose")
                    : t("profile.addresses.addToggleOpen")}
                </button>
              </div>

              {showAddForm ? (
                <div className="border border-dashed border-border rounded-[var(--radius-lg)] p-4 mb-4 space-y-3">
                  {(
                    [
                      { key: "street", labelKey: "profile.addresses.fields.street" },
                      { key: "ward", labelKey: "profile.addresses.fields.ward" },
                      { key: "district", labelKey: "profile.addresses.fields.district" },
                      { key: "city", labelKey: "profile.addresses.fields.city" },
                      { key: "phone", labelKey: "profile.addresses.fields.phone" },
                    ] as const
                  ).map((field) => (
                    <div key={field.key}>
                      <label
                        htmlFor={`addr-${field.key}`}
                        className="block text-xs font-medium text-muted-foreground mb-1"
                      >
                        {t(field.labelKey)}
                      </label>
                      <input
                        id={`addr-${field.key}`}
                        value={newAddress[field.key] ?? ""}
                        onChange={(e) =>
                          setNewAddress((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] text-sm outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={newAddress.isDefault ?? false}
                      onChange={(e) =>
                        setNewAddress((prev) => ({ ...prev, isDefault: e.target.checked }))
                      }
                    />
                    {t("profile.addresses.setDefault")}
                  </label>
                  <button
                    onClick={() => {
                      if (!newAddress.street || !newAddress.district || !newAddress.city) {
                        toast.error(t("profile.addresses.validateMissing"));
                        return;
                      }
                      addAddressMutation.mutate(newAddress);
                    }}
                    disabled={addAddressMutation.isPending}
                    className="w-full py-2.5 rounded-[var(--radius-md)] bg-primary text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addAddressMutation.isPending
                      ? t("profile.addresses.saving")
                      : t("profile.addresses.saveAddress")}
                  </button>
                </div>
              ) : null}

              {addresses.length === 0 && !showAddForm ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {t("profile.addresses.empty")}
                </div>
              ) : null}

              <div className="space-y-3">
                {addresses.map((addr, i) => (
                  <div
                    key={`${addr.street}|${addr.city}|${String(i)}`}
                    className="border border-border rounded-[var(--radius-lg)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-foreground">
                            {displayName}
                          </span>
                          {addr.phone ? (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-sm text-muted-foreground">{addr.phone}</span>
                            </>
                          ) : null}
                          {addr.isDefault ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium border border-primary text-primary">
                              {t("profile.addresses.isDefaultBadge")}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-start gap-1.5">
                          <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {formatAddressLine(addr)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {!addr.isDefault ? (
                          <button
                            onClick={() => removeAddressMutation.mutate(addressKey(addr))}
                            aria-label="Remove address"
                            className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-red-200 text-red-400 hover:bg-red-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {!addr.isDefault ? (
                      <button
                        onClick={() => setDefaultMutation.mutate(addressKey(addr))}
                        disabled={setDefaultMutation.isPending}
                        className="mt-3 text-xs font-medium text-primary disabled:opacity-50"
                      >
                        {t("profile.addresses.setDefault")}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "payment" ? (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-6">
                {t("profile.payment.title")}
              </h2>
              <div className="rounded-[var(--radius-lg)] bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{t("profile.payment.comingSoonBanner")}</p>
              </div>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div>
              <h2 className="text-lg font-bold text-foreground mb-6">
                {t("profile.security.title")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">{t("profile.security.subtitle")}</p>
              <p className="rounded-[var(--radius-md)] border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {t("profile.security.nativeBoundary", {
                  defaultValue:
                    "Password and session security are handled by VNShop's protected account service.",
                })}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
