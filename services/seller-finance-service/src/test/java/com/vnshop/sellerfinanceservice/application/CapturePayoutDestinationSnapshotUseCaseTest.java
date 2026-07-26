package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationMaterial;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutDestinationClient;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CapturePayoutDestinationSnapshotUseCaseTest {

    @Test
    void capture_happyPath_returnsSealedSnapshot() {
        PayoutDestinationClient client = id -> Optional.of(
                new PayoutDestinationMaterial("dest-1", "seller-1", "v1.iv.ct.tag", 1, "AES-256-GCM", "abcd"));
        CapturePayoutDestinationSnapshotUseCase useCase = new CapturePayoutDestinationSnapshotUseCase(client);

        PayoutDestinationSnapshot snapshot = useCase.captureOrNull("seller-1", "Vietcombank", "1234");

        assertThat(snapshot.sellerId()).isEqualTo("seller-1");
        assertThat(snapshot.destinationId()).isEqualTo("dest-1");
        assertThat(snapshot.keyVersion()).isEqualTo(1);
        assertThat(snapshot.bankAccountLast4()).isEqualTo("1234");
        assertThat(snapshot.capturedAt()).isNotNull();
        assertThat(CapturePayoutDestinationSnapshotUseCase.auditLog(snapshot))
                .contains("destinationFingerprint=abcd0000".substring(0, 12));
    }

    @Test
    void capture_missingDestination_throws() {
        PayoutDestinationClient client = id -> Optional.empty();
        CapturePayoutDestinationSnapshotUseCase useCase = new CapturePayoutDestinationSnapshotUseCase(client);
        assertThatThrownBy(() -> useCase.captureOrNull("missing", "Bank", "1234"))
                .isInstanceOf(java.util.NoSuchElementException.class);
    }

    @Test
    void capture_blankSellerId_throws() {
        PayoutDestinationClient client = id -> Optional.empty();
        CapturePayoutDestinationSnapshotUseCase useCase = new CapturePayoutDestinationSnapshotUseCase(client);
        assertThatThrownBy(() -> useCase.captureOrNull("", "Bank", "1234"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> useCase.captureOrNull(null, "Bank", "1234"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}