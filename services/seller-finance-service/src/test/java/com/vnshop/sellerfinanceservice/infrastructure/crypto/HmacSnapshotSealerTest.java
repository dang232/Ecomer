package com.vnshop.sellerfinanceservice.infrastructure.crypto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;

class HmacSnapshotSealerTest {

    private static final byte[] KEY = new byte[]{
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
            0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
            0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
            0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f
    };

    private SnapshotSealer sealer(int version) {
        String b64 = Base64.getEncoder().encodeToString(KEY);
        return new HmacSnapshotSealer(Map.of(version, Base64.getDecoder().decode(b64)));
    }

    @Test
    void sealThenVerify_succeeds() {
        SnapshotSealer s = sealer(1);
        String envelope = s.seal("canonical|snapshotId=abc|sellerId=xyz");
        assertThat(envelope).startsWith("k1.");
        s.verify("canonical|snapshotId=abc|sellerId=xyz", envelope);
    }

    @Test
    void verify_tamperedCanonical_throws() {
        SnapshotSealer s = sealer(1);
        String envelope = s.seal("canonical-1");
        assertThatThrownBy(() -> s.verify("canonical-2", envelope))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void verify_tamperedEnvelope_throws() {
        SnapshotSealer s = sealer(1);
        String envelope = s.seal("canonical");
        String[] parts = envelope.split("\\.");
        // Flip a bit of the tag.
        byte[] tag = Base64.getDecoder().decode(parts[1]);
        tag[0] = (byte) (tag[0] ^ 0x01);
        parts[1] = Base64.getEncoder().encodeToString(tag);
        String tampered = String.join(".", parts);
        assertThatThrownBy(() -> s.verify("canonical", tampered))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void emptyKeys_failLoud() {
        assertThatThrownBy(() -> new HmacSnapshotSealer(Map.of()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void malformedEnvelope_throws() {
        SnapshotSealer s = sealer(1);
        assertThatThrownBy(() -> s.verify("anything", "garbage"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unknownVersion_throws() {
        SnapshotSealer s = sealer(1);
        assertThatThrownBy(() -> s.verify("any", "k9.aaaa"))
                .isInstanceOf(IllegalStateException.class);
    }
}