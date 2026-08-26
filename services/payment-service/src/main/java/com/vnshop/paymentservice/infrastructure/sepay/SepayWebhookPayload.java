package com.vnshop.paymentservice.infrastructure.sepay;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * SePay push-callback payload.
 *
 * <p>SePay sends a JSON body when a bank credit is confirmed. Only the fields
 * relevant to payment matching are mapped here; unknown fields are ignored.
 *
 * <p>SePay API reference: https://docs.sepay.vn/webhook.html
 */
public record SepayWebhookPayload(
        /** SePay internal transaction id. */
        String id,
        /** Bank transfer memo — expected to contain the VNShop payment UUID. */
        @JsonProperty("transaction_content") String transactionContent,
        /** Credited amount in VND. */
        @JsonProperty("transferAmount") BigDecimal transferAmount,
        /** Bank account number that received the credit. */
        @JsonProperty("accountNumber") String accountNumber,
        /** Bank code / BIN. */
        @JsonProperty("bankBrandName") String bankBrandName,
        @JsonProperty("currency") String currency,
        @JsonProperty("transferType") String transferType
) {
    public SepayWebhookPayload(String id, String transactionContent, BigDecimal transferAmount,
                               String accountNumber, String bankBrandName) {
        this(id, transactionContent, transferAmount, accountNumber, bankBrandName, "VND", "CREDIT");
    }
    /**
     * Produces a stable canonical string for hashing / idempotency.
     * Uses only the fields that identify the transaction, not time-varying metadata.
     */
    public String toCanonical() {
        return "id=" + nvl(id)
                + "&transaction_content=" + nvl(transactionContent)
                + "&transferAmount=" + (transferAmount != null ? transferAmount.toPlainString() : "")
                + "&accountNumber=" + nvl(accountNumber)
                + "&currency=" + nvl(currency)
                + "&transferType=" + nvl(transferType);
    }

    private static String nvl(String s) {
        return s != null ? s : "";
    }
}
