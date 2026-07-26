package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer;
import com.vnshop.sellerfinanceservice.infrastructure.crypto.HmacSnapshotSealer;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SealPayoutDestinationSnapshotUseCaseTest {

    private static final byte[] KEY = new byte[]{
            0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
            0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
            0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
            0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f
    };

    private static PayoutDestinationSnapshot sampleSnapshot(String integrityEnvelope) {
        return new PayoutDestinationSnapshot(
                "snap-1",
                "seller-1",
                "dest-1",
                "v1.iv.ct.tag",
                1,
                "AES-256-GCM",
                "deadbeefcafebabe",
                "1234",
                "Vietcombank",
                Instant.parse("2026-01-01T00:00:00Z"),
                integrityEnvelope
        );
    }

    @Test
    void seal_assignsIntegrityEnvelope() {
        SnapshotSealer sealer = newSealer();
        SealPayoutDestinationSnapshotUseCase useCase = new SealPayoutDestinationSnapshotUseCase(sealer);
        PayoutDestinationSnapshot sealed = useCase.seal(sampleSnapshot(""));

        assertThat(sealed.integrityEnvelope()).startsWith("k1.");
        useCase.verify(sealed);
    }

    @Test
    void seal_isIdempotent_onlyLastEnvelopeKept() {
        SnapshotSealer sealer = newSealer();
        SealPayoutDestinationSnapshotUseCase useCase = new SealPayoutDestinationSnapshotUseCase(sealer);
        PayoutDestinationSnapshot a = useCase.seal(sampleSnapshot(""));
        PayoutDestinationSnapshot b = useCase.seal(a);
        assertThat(b.integrityEnvelope()).isEqualTo(a.integrityEnvelope());
        useCase.verify(b);
    }

    @Test
    void verify_tamperedSnapshot_throws() {
        SnapshotSealer sealer = newSealer();
        SealPayoutDestinationSnapshotUseCase useCase = new SealPayoutDestinationSnapshotUseCase(sealer);
        PayoutDestinationSnapshot sealed = useCase.seal(sampleSnapshot(""));
        PayoutDestinationSnapshot tampered = new PayoutDestinationSnapshot(
                sealed.snapshotId(), sealed.sellerId(), sealed.destinationId(),
                sealed.ciphertext(), sealed.keyVersion(), sealed.algorithm(),
                "different-fingerprint", sealed.bankAccountLast4(), sealed.bankName(),
                sealed.capturedAt(), sealed.integrityEnvelope()
        );
        assertThatThrownBy(() -> useCase.verify(tampered))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void seal_null_throws() {
        SnapshotSealer sealer = newSealer();
        SealPayoutDestinationSnapshotUseCase useCase = new SealPayoutDestinationSnapshotUseCase(sealer);
        assertThatThrownBy(() -> useCase.seal(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static SnapshotSealer newSealer() {
        String b64 = Base64.getEncoder().encodeToString(KEY);
        return new HmacSnapshotSealer(Map.of(1, Base64.getDecoder().decode(b64)));
    }
}