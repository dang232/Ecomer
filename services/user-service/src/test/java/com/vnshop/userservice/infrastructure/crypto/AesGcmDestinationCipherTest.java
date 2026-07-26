package com.vnshop.userservice.infrastructure.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class AesGcmDestinationCipherTest {

    private static final byte[] KEY_BYTES = new byte[]{
            0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, (byte) 0x80,
            (byte) 0x90, (byte) 0xa0, (byte) 0xb0, (byte) 0xc0, (byte) 0xd0, (byte) 0xe0, (byte) 0xf0, 0x01,
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, (byte) 0x88,
            (byte) 0x99, (byte) 0xaa, (byte) 0xbb, (byte) 0xcc, (byte) 0xdd, (byte) 0xee, (byte) 0xff, 0x02
    };

    private CipherPort cipherFor(int version) {
        String b64 = Base64.getEncoder().encodeToString(KEY_BYTES);
        return new AesGcmDestinationCipher(Map.of(version, b64), version);
    }

    @Test
    void roundTrip_v1_succeeds() {
        CipherPort cipher = cipherFor(1);
        String envelope = cipher.encrypt("VIETCOMBANK:1234567890", 1);
        assertThat(envelope).startsWith("v1.");
        assertThat(cipher.decrypt(envelope, 1)).isEqualTo("VIETCOMBANK:1234567890");
        assertThat(cipher.currentKeyVersion()).isEqualTo(1);
    }

    @Test
    void roundTrip_isDeterministicAcrossCalls() {
        CipherPort cipher = cipherFor(1);
        // Two encrypts with the same plaintext produce different ciphertexts (random IV) but both decrypt correctly.
        String a = cipher.encrypt("ABC", 1);
        String b = cipher.encrypt("ABC", 1);
        assertThat(a).isNotEqualTo(b);
        assertThat(cipher.decrypt(a, 1)).isEqualTo("ABC");
        assertThat(cipher.decrypt(b, 1)).isEqualTo("ABC");
    }

    @Test
    void tamperedCiphertext_throws() {
        CipherPort cipher = cipherFor(1);
        String envelope = cipher.encrypt("plaintext", 1);
        String[] parts = envelope.split("\\.");
        // Flip a byte in the ciphertext component.
        byte[] ct = Base64.getDecoder().decode(parts[2]);
        ct[0] = (byte) (ct[0] ^ 0x01);
        parts[2] = Base64.getEncoder().encodeToString(ct);
        String tampered = String.join(".", parts);

        assertThatThrownBy(() -> cipher.decrypt(tampered, 1))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unknownKeyVersion_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.encrypt("anything", 9))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void wrongKeyVersionOnDecrypt_throws() {
        CipherPort cipher = cipherFor(1);
        String envelope = cipher.encrypt("plaintext", 1);
        assertThatThrownBy(() -> cipher.decrypt(envelope, 9))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void malformedEnvelope_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.decrypt("not-an-envelope", 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> cipher.decrypt("", 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> cipher.decrypt(null, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void emptyKeys_failLoud() {
        assertThatThrownBy(() -> new AesGcmDestinationCipher(Map.of(), 1))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void zeroCurrentKeyVersion_failLoud() {
        assertThatThrownBy(() -> cipherFor(0))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void wrongKeyLength_failLoud() {
        String shortKey = Base64.getEncoder().encodeToString(new byte[8]);
        assertThatThrownBy(() -> new AesGcmDestinationCipher(Map.of(1, shortKey), 1))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void encrypt_nullPlaintext_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.encrypt(null, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void decrypt_unknownKeyVersionOnEnvelope_throws() {
        CipherPort cipher = cipherFor(1);
        String envelope = cipher.encrypt("plaintext", 1);
        assertThatThrownBy(() -> cipher.decrypt(envelope, 99))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void decrypt_envelopeVersionMismatch_throws() {
        // Build a cipher carrying keys v1+v2, then ask it to decrypt a v1 envelope
        // but pass the keyVersion argument as 2 — the embedded version differs.
        String b64 = Base64.getEncoder().encodeToString(KEY_BYTES);
        CipherPort cipher = new AesGcmDestinationCipher(Map.of(1, b64, 2, b64), 2);
        String v1Envelope = cipher.encrypt("plaintext", 1);
        assertThatThrownBy(() -> cipher.decrypt(v1Envelope, 2))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("version mismatch");
    }

    @Test
    void decrypt_malformedEnvelope_threeParts_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.decrypt("v1.aa.bb", 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("malformed");
    }

    @Test
    void decrypt_nonNumericVersion_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.decrypt("vX.aa.bb.cc", 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not a number");
    }

    @Test
    void decrypt_tagTampered_throws() {
        CipherPort cipher = cipherFor(1);
        String envelope = cipher.encrypt("plaintext", 1);
        String[] parts = envelope.split("\\.");
        byte[] tag = Base64.getDecoder().decode(parts[3]);
        tag[0] = (byte) (tag[0] ^ 0x01);
        parts[3] = Base64.getEncoder().encodeToString(tag);
        String tampered = String.join(".", parts);
        assertThatThrownBy(() -> cipher.decrypt(tampered, 1))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unknownKeyVersionOnEncrypt_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.encrypt("anything", 99))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown key version");
    }

    @Test
    void invalidBase64Key_failsLoud() {
        assertThatThrownBy(() -> new AesGcmDestinationCipher(Map.of(1, "not!base64!@#$"), 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("invalid base64");
    }

    @Test
    void nullKeysMap_failsLoud() {
        assertThatThrownBy(() -> new AesGcmDestinationCipher(null, 1))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void currentKeyVersionMissingFromKeys_failsLoud() {
        String b64 = Base64.getEncoder().encodeToString(KEY_BYTES);
        assertThatThrownBy(() -> new AesGcmDestinationCipher(Map.of(1, b64), 2))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not present");
    }

    @Test
    void keyVersionZeroInMap_failsLoud() {
        String b64 = Base64.getEncoder().encodeToString(KEY_BYTES);
        assertThatThrownBy(() -> new AesGcmDestinationCipher(Map.of(0, b64), 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("invalid");
    }

    @Test
    void currentKeyVersionPlaceholderZero_failsLoud() {
        assertThatThrownBy(() -> new AesGcmDestinationCipher(Map.of(1, Base64.getEncoder().encodeToString(KEY_BYTES)), 0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be > 0");
    }

    @Test
    void decryptsEnvelopeUsingSellerFinanceVersionTokenAad() throws GeneralSecurityException {
        CipherPort cipher = cipherFor(1);
        byte[] iv = new byte[]{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1};
        SecretKeySpec key = new SecretKeySpec(KEY_BYTES, "AES");
        Cipher jce = Cipher.getInstance("AES/GCM/NoPadding");
        jce.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        jce.updateAAD("v1".getBytes(StandardCharsets.US_ASCII));
        byte[] plain = "VIETCOMBANK:1234567890".getBytes(StandardCharsets.UTF_8);
        byte[] ciphertextAndTag = jce.doFinal(plain);
        byte[] ciphertext = java.util.Arrays.copyOf(ciphertextAndTag, plain.length);
        byte[] tag = java.util.Arrays.copyOfRange(ciphertextAndTag, plain.length, ciphertextAndTag.length);
        String envelope = "v1." + Base64.getEncoder().encodeToString(iv)
                + "." + Base64.getEncoder().encodeToString(ciphertext)
                + "." + Base64.getEncoder().encodeToString(tag);

        assertThat(cipher.decrypt(envelope, 1)).isEqualTo("VIETCOMBANK:1234567890");
    }

    @Test
    void encryptsEnvelopeThatSellerFinanceCanDecryptWithVersionTokenAad() throws GeneralSecurityException {
        CipherPort cipher = cipherFor(1);
        String envelope = cipher.encrypt("VIETCOMBANK:1234567890", 1);
        String[] parts = envelope.split("\\.", -1);
        SecretKeySpec key = new SecretKeySpec(KEY_BYTES, "AES");
        Cipher jce = Cipher.getInstance("AES/GCM/NoPadding");
        jce.init(Cipher.DECRYPT_MODE, key,
                new GCMParameterSpec(128, Base64.getDecoder().decode(parts[1])));
        jce.updateAAD(parts[0].getBytes(StandardCharsets.US_ASCII));
        byte[] ciphertext = Base64.getDecoder().decode(parts[2]);
        byte[] tag = Base64.getDecoder().decode(parts[3]);
        byte[] ciphertextAndTag = new byte[ciphertext.length + tag.length];
        System.arraycopy(ciphertext, 0, ciphertextAndTag, 0, ciphertext.length);
        System.arraycopy(tag, 0, ciphertextAndTag, ciphertext.length, tag.length);

        assertThat(new String(jce.doFinal(ciphertextAndTag), StandardCharsets.UTF_8))
                .isEqualTo("VIETCOMBANK:1234567890");
    }
}
