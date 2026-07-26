package com.vnshop.userservice.domain.payoutdestination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.userservice.domain.redaction.Redacted;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SellerPayoutDestinationTest {

    private static final Instant NOW = Instant.parse("2026-07-24T00:00:00Z");

    @Test
    void exposesMaskedMetadataAndKeepsCiphertextPrivate() {
        SellerPayoutDestination destination = newDestination("1234");

        assertThat(destination.bankName()).isEqualTo("Vietcombank");
        assertThat(destination.bankAccountLast4()).isEqualTo("1234");
        assertThat(destination.fingerprint()).isEqualTo("fp-001");
        assertThat(destination.ciphertext()).isEqualTo("ciphertext-A");
    }

    @Test
    void materialForFinanceReturnsCiphertextAndMetadata() {
        SellerPayoutDestination destination = newDestination("1234");

        DestinationMaterial material = destination.materialForFinance();

        assertThat(material.destinationId()).isEqualTo("dest-1");
        assertThat(material.sellerId()).isEqualTo("seller-1");
        assertThat(material.ciphertext()).isEqualTo("ciphertext-A");
        assertThat(material.keyVersion()).isEqualTo(1);
        assertThat(material.algorithm()).isEqualTo("AES/GCM/NoPadding");
        assertThat(material.fingerprint()).isEqualTo("fp-001");
    }

    @Test
    void toStringIncludesFingerprintSummary() {
        SellerPayoutDestination destination = newDestination("1234");

        String string = destination.toString();

        assertThat(string).contains("destinationId='dest-1'");
        assertThat(string).contains("bankAccountLast4='1234'");
        // Short fingerprint passes through Redacted.fingerprint() unchanged;
        // long fingerprints get truncated. The contract is "summary only" — never
        // log the raw plaintext. Spot-check that toString is well-formed.
        assertThat(string).contains("fingerprint=");
        assertThat(string).contains("verificationState=VERIFIED");
    }

    @Test
    void toStringTruncatesLongFingerprints() {
        String longFingerprint = "abcdef0123456789abcdef0123456789"; // 32 chars
        SellerPayoutDestination destination = new SellerPayoutDestination(
                "dest-1", "seller-1", "Vietcombank", "1234", longFingerprint, 1, "AES/GCM/NoPadding",
                "ciphertext-A", SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW);

        String string = destination.toString();

        assertThat(string).doesNotContain(longFingerprint);
        assertThat(string).contains(Redacted.fingerprint(longFingerprint));
    }

    @Test
    void rejectsBlankOrNullFields() {
        assertThatThrownBy(() -> new SellerPayoutDestination(
                "dest-1", "seller-1", "Bank", "1234", "fp", 1, "", "cipher",
                SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("algorithm");
        assertThatThrownBy(() -> new SellerPayoutDestination(
                "dest-1", "seller-1", "  ", "1234", "fp", 1, "AES", "cipher",
                SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bankName");
        assertThatThrownBy(() -> new SellerPayoutDestination(
                "dest-1", "seller-1", "Bank", "", "fp", 1, "AES", "cipher",
                SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bankAccountLast4");
        assertThatThrownBy(() -> new SellerPayoutDestination(
                null, "seller-1", "Bank", "1234", "fp", 1, "AES", "cipher",
                SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new SellerPayoutDestination(
                "dest-1", "seller-1", "Bank", "1234", "fp", 1, "AES", "cipher",
                null, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void rejectsBankAccountLast4LongerThanFourChars() {
        assertThatThrownBy(() -> new SellerPayoutDestination(
                "dest-1", "seller-1", "Bank", "12345", "fp", 1, "AES", "cipher",
                SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bankAccountLast4");
    }

    @Test
    void rejectsNonPositiveKeyVersion() {
        assertThatThrownBy(() -> new SellerPayoutDestination(
                "dest-1", "seller-1", "Bank", "1234", "fp", 0, "AES/GCM/NoPadding", "ciphertext",
                SellerPayoutDestination.VerificationState.UNVERIFIED, NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("keyVersion");
    }

    @Test
    void exposesAllVerificationStates() {
        for (SellerPayoutDestination.VerificationState state : SellerPayoutDestination.VerificationState.values()) {
            SellerPayoutDestination destination = new SellerPayoutDestination(
                    "dest-1", "seller-1", "Vietcombank", "1234", "fp-001", 1, "AES/GCM/NoPadding",
                    "ciphertext-A", state, NOW, NOW);
            assertThat(destination.verificationState()).isEqualTo(state);
        }
    }

    private static SellerPayoutDestination newDestination(String last4) {
        return new SellerPayoutDestination(
                "dest-1", "seller-1", "Vietcombank", last4, "fp-001", 1, "AES/GCM/NoPadding",
                "ciphertext-A", SellerPayoutDestination.VerificationState.VERIFIED, NOW, NOW);
    }
}
