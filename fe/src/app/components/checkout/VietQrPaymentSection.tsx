import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { paymentStatus, vietqrCreate } from "@/shared/api/endpoints/payment";
import { ImageWithFallback } from "@/shared/ui";

interface Props {
  orderId: string;
  idempotencyKey: string;
  initialization?: {
    qrImageUrl: string;
    reference: string;
  };
  onCompleted: () => void;
}

export function VietQrPaymentSection({
  orderId,
  idempotencyKey,
  initialization,
  onCompleted,
}: Props) {
  const { t } = useTranslation();
  const [qr, setQr] = useState<{
    qrImageUrl: string;
    accountNo?: string;
    accountName?: string;
    reference: string;
  } | null>(initialization ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (qr || error) return;
    vietqrCreate({ orderId }, idempotencyKey)
      .then((res) =>
        setQr({
          qrImageUrl: res.qrImageUrl,
          accountNo: res.accountNo,
          accountName: res.accountName,
          reference: res.reference,
        }),
      )
      .catch((err: Error) => setError(err.message));
  }, [orderId, idempotencyKey, qr, error]);

  useEffect(() => {
    if (!qr) return;
    const deadline = Date.now() + 10 * 60_000;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || Date.now() > deadline) return;
      try {
        const status = await paymentStatus(orderId);
        if (status.status === "COMPLETED") {
          onCompleted();
          return;
        }
      } catch {
        // ignore transient
      }
      if (!cancelled) {
        window.setTimeout(() => {
          void tick();
        }, 5000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [qr, orderId, onCompleted]);

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!qr) {
    return (
      <div className="rounded-2xl border-2 border-border p-4 text-sm text-muted-foreground">
        {t("vietqr.creating")}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-2 border-border p-6 space-y-4 text-center"
      data-testid="vietqr-section"
    >
      <ImageWithFallback
        src={qr.qrImageUrl}
        alt={t("vietqr.altText")}
        className="mx-auto w-64 h-64 object-contain"
        imagePreset="detail"
        sizes="256px"
        data-testid="vietqr-image"
      />
      <div className="text-sm text-foreground space-y-1">
        {qr.accountNo ? (
          <p>
            <strong>{t("vietqr.accountLabel")}</strong> {qr.accountNo}
          </p>
        ) : null}
        {qr.accountName ? (
          <p>
            <strong>{t("vietqr.nameLabel")}</strong> {qr.accountName}
          </p>
        ) : null}
        <p>
          <strong>{t("vietqr.referenceLabel")}</strong> <code>{qr.reference}</code>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("vietqr.autoUpdate")}</p>
    </div>
  );
}
