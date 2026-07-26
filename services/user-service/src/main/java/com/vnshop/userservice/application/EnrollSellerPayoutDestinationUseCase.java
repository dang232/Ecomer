package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import com.vnshop.userservice.domain.redaction.Redacted;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Encrypts a newly-entered destination payload and re-enrolls it on
 * the seller's profile. Called by the seller-facing
 * {@code POST /sellers/me/payout-destination} endpoint and the
 * admin-facing replacement endpoint.
 *
 * <p>Plaintext is never written to logs, exceptions, or the returned
 * domain object; only the ciphertext envelope + masking survive.
 */
public class EnrollSellerPayoutDestinationUseCase {

    private static final Logger log = LoggerFactory.getLogger(EnrollSellerPayoutDestinationUseCase.class);

    private final UserRepositoryPort userRepositoryPort;
    private final CipherPort cipher;

    public EnrollSellerPayoutDestinationUseCase(UserRepositoryPort userRepositoryPort, CipherPort cipher) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
        this.cipher = Objects.requireNonNull(cipher, "cipher is required");
    }

    public SellerProfile enroll(EnrollDestinationCommand command) {
        if (command == null) throw new IllegalArgumentException("command is required");
        SellerProfile profile = userRepositoryPort.findSellerById(command.sellerId())
                .orElseThrow(() -> new IllegalArgumentException("seller profile not found"));

        String last4 = last4Of(command.bankAccount());
        String fingerprint = fingerprint(command.bankName(), command.bankAccount());
        int keyVersion = cipher.currentKeyVersion();
        String envelope = cipher.encrypt(
                canonicalPlaintext(command.bankName(), command.bankAccount()),
                keyVersion
        );
        Instant now = Instant.now();
        Instant enrolledAt = profile.destination()
                .map(SellerPayoutDestination::enrolledAt)
                .orElse(now);

        SellerPayoutDestination destination = new SellerPayoutDestination(
                UUID.randomUUID().toString(),
                profile.id(),
                command.bankName(),
                last4,
                fingerprint,
                keyVersion,
                SellerPayoutDestination.PERSISTED_ALGORITHM,
                envelope,
                VerificationState.PENDING,
                enrolledAt,
                now
        );

        profile.enrollDestination(destination);
        SellerProfile saved = userRepositoryPort.updateSeller(profile);

        log.info("enrolled payout destination for sellerId={} destinationId={} fingerprint={} state={}",
                profile.id(), destination.destinationId(),
                Redacted.fingerprint(fingerprint),
                destination.verificationState());

        return saved;
    }

    /** Canonical form that gets encrypted. Independent of input casing. */
    private static String canonicalPlaintext(String bankName, String bankAccount) {
        return (bankName.trim().toUpperCase() + ":" + bankAccount.trim());
    }

    private static String fingerprint(String bankName, String bankAccount) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(canonicalPlaintext(bankName, bankAccount).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static String last4Of(String account) {
        if (account == null) return "0000";
        String trimmed = account.trim();
        if (trimmed.length() <= 4) return trimmed.isBlank() ? "0000" : trimmed;
        return trimmed.substring(trimmed.length() - 4);
    }
}
