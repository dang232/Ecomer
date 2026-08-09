package com.vnshop.userservice.domain.port.out;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import com.vnshop.userservice.domain.SellerProfile;

import java.util.List;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserRepositoryPort {
    BuyerProfile saveBuyer(BuyerProfile buyerProfile);

    Optional<BuyerProfile> findBuyerByKeycloakId(String keycloakId);

    /** Exact canonical-phone lookup used to enforce buyer phone ownership. */
    Optional<BuyerProfile> findBuyerByPhone(PhoneNumber phone);

    /**
     * Batch lookup for public profile rendering. Returns only the buyers
     * that exist; missing ids are silently dropped. Order is not
     * guaranteed; callers should index by {@link BuyerProfile#keycloakId()}.
     */
    List<BuyerProfile> findBuyersByKeycloakIds(List<String> keycloakIds);

    /** Admin directory search across persisted identity and display fields. */
    Page<BuyerProfile> searchBuyers(String query, Pageable pageable);

    List<BuyerProfile> searchBuyersCursor(String query, AdminBuyerCursor cursor, int limit);

    SellerProfile saveSeller(SellerProfile sellerProfile);

    Optional<SellerProfile> findSellerById(String sellerId);

    /** Batch lookup for service-owned public seller display projections. */
    List<SellerProfile> findSellersByIds(List<String> sellerIds);

    List<SellerProfile> findPendingSellers();

    default List<SellerProfile> findPendingSellers(String query) {
        return findPendingSellers();
    }

    List<SellerProfile> findPendingSellersCursor(String query, AdminSellerCursor cursor, int limit);

    SellerProfile updateSeller(SellerProfile sellerProfile);

    List<SellerProfile> findApprovedSellers(int page, int size);

    long countApprovedSellers();

    /**
     * Anonymizes PII fields for the buyer with the given Keycloak id.
     * Called as part of the GDPR right-to-erasure flow.
     */
    void anonymize(String keycloakId);
}
