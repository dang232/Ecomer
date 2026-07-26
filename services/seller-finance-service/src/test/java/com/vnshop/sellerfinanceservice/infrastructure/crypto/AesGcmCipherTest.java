package com.vnshop.sellerfinanceservice.infrastructure.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.CipherPort;
import java.util.Base64;
import java.util.Map;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;

class AesGcmCipherTest {

    private static final byte[] KEY_BYTES = new byte[]{
            0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, (byte) 0x80,
            (byte) 0x90, (byte) 0xa0, (byte) 0xb0, (byte) 0xc0, (byte) 0xd0, (byte) 0xe0, (byte) 0xf0, 0x01,
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, (byte) 0x88,
            (byte) 0x99, (byte) 0xaa, (byte) 0xbb, (byte) 0xcc, (byte) 0xdd, (byte) 0xee, (byte) 0xff, 0x02
    };

    private CipherPort cipherFor(int version) {
        SecretKey key = AesGcmCipher.decodeBase64Key(Base64.getEncoder().encodeToString(KEY_BYTES));
        return new AesGcmCipher(Map.of(version, key));
    }

    @Test
    void decrypt_succeeds_whenKeyMatchesEnvelopeVersion() {
        CipherPort cipher = cipherFor(1);
        // Build a valid envelope manually using the Java Cipher primitives.
        SecretKey key = AesGcmCipher.decodeBase64Key(Base64.getEncoder().encodeToString(KEY_BYTES));
        byte[] iv = new byte[]{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1};
        try {
            javax.crypto.Cipher c = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            c.init(javax.crypto.Cipher.ENCRYPT_MODE, key, new javax.crypto.spec.GCMParameterSpec(128, iv));
            c.updateAAD("v1".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            byte[] plain = "VIETCOMBANK:1234".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            byte[] ctAndTag = c.doFinal(plain);
            byte[] ct = new byte[plain.length];
            byte[] tag = new byte[16];
            System.arraycopy(ctAndTag, 0, ct, 0, plain.length);
            System.arraycopy(ctAndTag, plain.length, tag, 0, 16);
            String envelope = "v1." + Base64.getEncoder().encodeToString(iv)
                    + "." + Base64.getEncoder().encodeToString(ct)
                    + "." + Base64.getEncoder().encodeToString(tag);
            assertThat(cipher.decrypt(envelope)).isEqualTo("VIETCOMBANK:1234");
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    @Test
    void unknownVersion_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.decrypt("v9.aaaa.bbbb.cccc"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void tamperedCiphertext_throws() {
        CipherPort cipher = cipherFor(1);
        // Synthesize a tampered envelope with a wrong GCM tag.
        String envelope = "v1."
                + Base64.getEncoder().encodeToString(new byte[12])
                + "." + Base64.getEncoder().encodeToString(new byte[]{1, 2, 3, 4, 5})
                + "." + Base64.getEncoder().encodeToString(new byte[16]);
        assertThatThrownBy(() -> cipher.decrypt(envelope))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void malformedEnvelope_throws() {
        CipherPort cipher = cipherFor(1);
        assertThatThrownBy(() -> cipher.decrypt("garbage"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> cipher.decrypt(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> cipher.decrypt(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void emptyKeys_failLoud() {
        assertThatThrownBy(() -> new AesGcmCipher(Map.of()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void wrongKeyLength_rejected() {
        assertThatThrownBy(() -> AesGcmCipher.decodeBase64Key(Base64.getEncoder().encodeToString(new byte[8])))
                .isInstanceOf(IllegalArgumentException.class);
    }
}