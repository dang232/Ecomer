package com.vnshop.userservice.domain.payoutdestination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DestinationMaterialTest {

    @Test
    void acceptsAWellFormedMaterial() {
        DestinationMaterial material = new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", 1, "AES/GCM/NoPadding", "fingerprint");

        assertThat(material.destinationId()).isEqualTo("dest-1");
        assertThat(material.keyVersion()).isEqualTo(1);
    }

    @Test
    void rejectsBlankFields() {
        assertThatThrownBy(() -> new DestinationMaterial(
                " ", "seller-1", "ciphertext", 1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("destinationId");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "", "ciphertext", 1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sellerId");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "", 1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ciphertext");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", 1, "", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("algorithm");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", 1, "AES", ""))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fingerprint");
    }

    @Test
    void rejectsNonPositiveKeyVersion() {
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", 0, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("keyVersion");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", -1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("keyVersion");
    }

    @Test
    void rejectsNullFields() {
        assertThatThrownBy(() -> new DestinationMaterial(
                null, "seller-1", "ciphertext", 1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("destinationId");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", null, "ciphertext", 1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sellerId");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", null, 1, "AES", "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ciphertext");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", 1, null, "fingerprint"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("algorithm");
        assertThatThrownBy(() -> new DestinationMaterial(
                "dest-1", "seller-1", "ciphertext", 1, "AES", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fingerprint");
    }
}