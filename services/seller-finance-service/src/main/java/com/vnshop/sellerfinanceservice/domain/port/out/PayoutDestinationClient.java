package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationMaterial;
import java.util.Optional;

/**
 * Service-to-service destination lookup. Returns encrypted material only;
 * the caller is responsible for snapshotting without ever touching plaintext.
 */
public interface PayoutDestinationClient {

    /** Returns the encrypted material for the seller's enrolled destination, or empty. */
    Optional<PayoutDestinationMaterial> lookup(String sellerId);
}