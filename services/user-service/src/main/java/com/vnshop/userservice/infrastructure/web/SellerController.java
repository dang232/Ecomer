package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.EnrollDestinationCommand;
import com.vnshop.userservice.application.EnrollSellerPayoutDestinationUseCase;
import com.vnshop.userservice.application.GetPublicSellerUseCase;
import com.vnshop.userservice.application.ListPublicSellersUseCase;
import com.vnshop.userservice.application.LookupSellerDestinationUseCase;
import com.vnshop.userservice.application.PublicSellersPage;
import com.vnshop.userservice.application.RegisterSellerCommand;
import com.vnshop.userservice.application.RegisterSellerUseCase;
import com.vnshop.userservice.application.ViewSellerProfileUseCase;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import com.vnshop.userservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/sellers")
public class SellerController {
    private final RegisterSellerUseCase registerSellerUseCase;
    private final ViewSellerProfileUseCase viewSellerProfileUseCase;
    private final GetPublicSellerUseCase getPublicSellerUseCase;
    private final ListPublicSellersUseCase listPublicSellersUseCase;
    private final EnrollSellerPayoutDestinationUseCase enrollSellerPayoutDestinationUseCase;
    private final LookupSellerDestinationUseCase lookupSellerDestinationUseCase;
    private final KeycloakAdminPort keycloakAdminPort;

    public SellerController(
            RegisterSellerUseCase registerSellerUseCase,
            ViewSellerProfileUseCase viewSellerProfileUseCase,
            GetPublicSellerUseCase getPublicSellerUseCase,
            ListPublicSellersUseCase listPublicSellersUseCase,
            EnrollSellerPayoutDestinationUseCase enrollSellerPayoutDestinationUseCase,
            LookupSellerDestinationUseCase lookupSellerDestinationUseCase,
            KeycloakAdminPort keycloakAdminPort) {
        this.registerSellerUseCase = registerSellerUseCase;
        this.viewSellerProfileUseCase = viewSellerProfileUseCase;
        this.getPublicSellerUseCase = getPublicSellerUseCase;
        this.listPublicSellersUseCase = listPublicSellersUseCase;
        this.enrollSellerPayoutDestinationUseCase = enrollSellerPayoutDestinationUseCase;
        this.lookupSellerDestinationUseCase = lookupSellerDestinationUseCase;
        this.keycloakAdminPort = keycloakAdminPort;
    }

    @PostMapping("/register")
    public ApiResponse<SellerProfileResponse> register(@Valid @RequestBody RegisterSellerRequest request) {
        var sellerProfile = registerSellerUseCase.register(new RegisterSellerCommand(
                JwtPrincipalUtil.currentUserId(),
                request.shopName(),
                request.bankName()
        ));
        return ApiResponse.ok(SellerProfileResponse.fromDomain(sellerProfile));
    }

    // Literal segment /me takes precedence over path variable /{id} — Spring MVC resolves
    // exact-segment matches before wildcard captures, so /sellers/me always hits this method.
    @GetMapping("/me")
    public ApiResponse<SellerProfileResponse> getMySellerProfile() {
        SellerProfile profile = viewSellerProfileUseCase.view(JwtPrincipalUtil.currentUserId());
        if (profile.approved()) {
            // Repair approvals created before role assignment was wired into the
            // admin command. Keycloak role mapping is idempotent.
            keycloakAdminPort.assignSellerRole(profile.id());
        }
        return ApiResponse.ok(SellerProfileResponse.fromDomain(profile));
    }

    @GetMapping("/{id}")
    public ApiResponse<PublicSellerResponse> getById(@PathVariable String id) {
        return ApiResponse.ok(PublicSellerResponse.fromView(getPublicSellerUseCase.view(id)));
    }

    /**
     * Seller self-enrolls payout destination. Bank account plaintext
     * is consumed in-memory and never persisted; only ciphertext + fingerprint + last4 are stored.
     */
    @PostMapping("/me/payout-destination")
    public ApiResponse<SellerProfileResponse> enrollMyDestination(@Valid @RequestBody EnrollPayoutDestinationRequest request) {
        var sellerProfile = enrollSellerPayoutDestinationUseCase.enroll(new EnrollDestinationCommand(
                JwtPrincipalUtil.currentUserId(),
                request.bankName(),
                request.bankAccount()
        ));
        return ApiResponse.ok(SellerProfileResponse.fromDomain(sellerProfile));
    }

    /**
     * Internal-only service-to-service destination lookup.
     * Returns encrypted material for finance snapshot building only.
     * Only callers bearing the {@code internal} role/client-id may invoke this.
     */
    @GetMapping("/internal/{sellerId}/payout-destination")
    @PreAuthorize("@internalServiceAuthorization.isAuthorized(authentication)")
    public ApiResponse<SellerPayoutDestinationMaterialResponse> internalLookupDestination(@PathVariable String sellerId) {
        return ApiResponse.ok(SellerPayoutDestinationMaterialResponse.fromDomain(
                lookupSellerDestinationUseCase.lookup(sellerId)));
    }

    /**
     * Public list of approved sellers, paged. Emits standard pagination headers
     * for non-React clients: {@code X-Total-Count} for the total element count,
     * and an RFC 5988 {@code Link} header with {@code rel="next"} and
     * {@code rel="prev"} when more pages exist. The body still carries the same
     * data so React Query and other clients don't have to read headers.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PublicSellersPageResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PublicSellersPage result = listPublicSellersUseCase.list(page, size);
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .header("X-Total-Count", Long.toString(result.totalElements()));
        String linkHeader = buildLinkHeader(result);
        if (!linkHeader.isEmpty()) builder.header("Link", linkHeader);
        return builder.body(ApiResponse.ok(PublicSellersPageResponse.fromPage(result)));
    }

    private static String buildLinkHeader(PublicSellersPage result) {
        StringBuilder sb = new StringBuilder();
        if (result.page() > 0) {
            appendLink(sb, result.page() - 1, result.size(), "prev");
        }
        if (result.page() + 1 < result.totalPages()) {
            appendLink(sb, result.page() + 1, result.size(), "next");
        }
        return sb.toString();
    }

    private static void appendLink(StringBuilder sb, int page, int size, String rel) {
        if (sb.length() > 0) sb.append(", ");
        String uri = UriComponentsBuilder.fromPath("/sellers")
                .queryParam("page", page)
                .queryParam("size", size)
                .build().toUriString();
        sb.append('<').append(uri).append(">; rel=\"").append(rel).append('"');
    }
}
