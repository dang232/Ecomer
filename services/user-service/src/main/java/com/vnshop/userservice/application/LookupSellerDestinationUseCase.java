package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.payoutdestination.DestinationMaterial;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import java.util.Objects;

/**
 * Service-to-service destination lookup. Returns the encrypted
 * destination material so the caller can build a finance snapshot
 * without ever touching plaintext.
 *
 * <p>Never wire this into a browser-facing endpoint.
 */
public class LookupSellerDestinationUseCase {

    private final UserRepositoryPort userRepositoryPort;

    public LookupSellerDestinationUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
    }

    public DestinationMaterial lookup(String sellerId) {
        if (sellerId == null || sellerId.isBlank()) {
            throw new IllegalArgumentException("sellerId is required");
        }
        SellerProfile profile = userRepositoryPort.findSellerById(sellerId)
                .orElseThrow(() -> new IllegalArgumentException("seller profile not found"));
        SellerPayoutDestination destination = profile.destination()
                .orElseThrow(() -> new IllegalStateException("seller has no enrolled payout destination"));
        if (!profile.hasVerifiedDestination()) {
            throw new IllegalStateException("seller payout destination is not verified");
        }
        return destination.materialForFinance();
    }
}
