package com.vnshop.userservice.infrastructure.migration;

import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import com.vnshop.userservice.infrastructure.config.PayoutBackfillProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs only when explicitly enabled for the controlled V10-to-V11 transition.
 * The runner never logs or returns the legacy account value, and every
 * generated envelope is decrypted before it is written.
 */
@Component
public class PayoutDestinationBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PayoutDestinationBackfillRunner.class);
    private static final String SELECT_LEGACY_ROWS = """
            SELECT id, keycloak_id, bank_name, bank_account,
                   destination_id, destination_fingerprint, destination_ciphertext,
                   destination_key_version, destination_algorithm, bank_account_last4,
                   verification_state
              FROM user_svc.seller_profiles
             WHERE bank_account IS NOT NULL
               AND btrim(bank_account) <> ''
             ORDER BY id
             FOR UPDATE
            """;
    private static final String UPDATE_DESTINATION = """
            UPDATE user_svc.seller_profiles
               SET destination_id = ?,
                   destination_fingerprint = ?,
                   destination_ciphertext = ?,
                   destination_key_version = ?,
                   destination_algorithm = ?,
                   bank_account_last4 = ?,
                   verification_state = ?,
                   destination_enrolled_at = COALESCE(destination_enrolled_at, created_at, CURRENT_TIMESTAMP),
                   destination_updated_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP,
                   bank_account = NULL
             WHERE id = ?
               AND bank_account IS NOT NULL
               AND btrim(bank_account) <> ''
            """;

    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;
    private final CipherPort cipher;
    private final PayoutBackfillProperties properties;
    private final ConfigurableApplicationContext applicationContext;

    public PayoutDestinationBackfillRunner(
            JdbcTemplate jdbcTemplate,
            TransactionTemplate transactionTemplate,
            CipherPort cipher,
            PayoutBackfillProperties properties,
            ConfigurableApplicationContext applicationContext) {
        this.jdbcTemplate = Objects.requireNonNull(jdbcTemplate, "jdbcTemplate is required");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate is required");
        this.cipher = Objects.requireNonNull(cipher, "cipher is required");
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.applicationContext = Objects.requireNonNull(applicationContext, "applicationContext is required");
    }

    @Override
    public void run(String... args) {
        if (!properties.enabled()) {
            return;
        }

        BackfillResult result = transactionTemplate.execute(status -> backfillRows());
        if (result == null) {
            throw new IllegalStateException("payout destination backfill did not complete");
        }

        int remaining = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_svc.seller_profiles "
                        + "WHERE bank_account IS NOT NULL AND btrim(bank_account) <> ''",
                Integer.class);
        if (remaining != 0) {
            throw new IllegalStateException(
                    "payout destination backfill left " + remaining + " legacy rows");
        }

        log.info("payout destination backfill completed migrated={} reused={} remaining=0",
                result.migrated(), result.reused());
        SpringApplication.exit(applicationContext, () -> 0);
    }

    private BackfillResult backfillRows() {
        List<LegacySellerRow> rows = jdbcTemplate.query(SELECT_LEGACY_ROWS, LEGACY_SELLER_ROW_MAPPER);
        int migrated = 0;
        int reused = 0;

        for (LegacySellerRow row : rows) {
            PreparedDestination destination = prepare(row);
            int updated = jdbcTemplate.update(
                    UPDATE_DESTINATION,
                    destination.destinationId(),
                    destination.fingerprint(),
                    destination.ciphertext(),
                    destination.keyVersion(),
                    destination.algorithm(),
                    destination.last4(),
                    destination.verificationState().name(),
                    row.id());
            if (updated != 1) {
                throw new IllegalStateException("seller payout destination row changed during backfill");
            }
            if (destination.reused()) {
                reused++;
            } else {
                migrated++;
            }
        }
        return new BackfillResult(migrated, reused);
    }

    private PreparedDestination prepare(LegacySellerRow row) {
        String canonical = canonicalPlaintext(row.bankName(), row.bankAccount());
        String expectedFingerprint = fingerprint(canonical);
        String expectedLast4 = last4Of(row.bankAccount());

        if (row.hasAnyDestinationColumns()) {
            if (!row.hasCompleteDestinationColumns()) {
                throw new IllegalStateException("seller payout destination metadata is incomplete");
            }
            if (!expectedFingerprint.equals(row.destinationFingerprint())
                    || !expectedLast4.equals(row.bankAccountLast4())
                    || !SellerPayoutDestination.PERSISTED_ALGORITHM.equals(row.destinationAlgorithm())
                    || !canonical.equals(cipher.decrypt(row.destinationCiphertext(), row.destinationKeyVersion()))) {
                throw new IllegalStateException("seller payout destination ciphertext failed verification");
            }
            VerificationState state = parseState(row.verificationState(), properties.verificationStateValue());
            return new PreparedDestination(
                    row.destinationId(), row.destinationFingerprint(), row.destinationCiphertext(),
                    row.destinationKeyVersion(), row.destinationAlgorithm(), row.bankAccountLast4(), state, true);
        }

        int keyVersion = cipher.currentKeyVersion();
        String ciphertext = cipher.encrypt(canonical, keyVersion);
        if (!canonical.equals(cipher.decrypt(ciphertext, keyVersion))) {
            throw new IllegalStateException("new seller payout destination ciphertext failed verification");
        }
        return new PreparedDestination(
                UUID.randomUUID().toString(), expectedFingerprint, ciphertext, keyVersion,
                SellerPayoutDestination.PERSISTED_ALGORITHM, expectedLast4,
                properties.verificationStateValue(), false);
    }

    private static VerificationState parseState(String raw, VerificationState fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return VerificationState.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("unknown existing payout destination state", ex);
        }
    }

    private static String canonicalPlaintext(String bankName, String bankAccount) {
        if (bankName == null || bankName.isBlank() || bankAccount == null || bankAccount.isBlank()) {
            throw new IllegalStateException("legacy seller payout destination is incomplete");
        }
        return bankName.trim().toUpperCase(Locale.ROOT) + ":" + bankAccount.trim();
    }

    private static String fingerprint(String canonicalPlaintext) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonicalPlaintext.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static String last4Of(String account) {
        String trimmed = account.trim();
        return trimmed.length() <= 4 ? trimmed : trimmed.substring(trimmed.length() - 4);
    }

    private record BackfillResult(int migrated, int reused) {}

    private record PreparedDestination(
            String destinationId,
            String fingerprint,
            String ciphertext,
            int keyVersion,
            String algorithm,
            String last4,
            VerificationState verificationState,
            boolean reused) {}

    private record LegacySellerRow(
            long id,
            String bankName,
            String bankAccount,
            String destinationId,
            String destinationFingerprint,
            String destinationCiphertext,
            Integer destinationKeyVersion,
            String destinationAlgorithm,
            String bankAccountLast4,
            String verificationState) {

        boolean hasAnyDestinationColumns() {
            return destinationId != null
                    || destinationFingerprint != null
                    || destinationCiphertext != null
                    || destinationKeyVersion != null
                    || destinationAlgorithm != null
                    || bankAccountLast4 != null;
        }

        boolean hasCompleteDestinationColumns() {
            return destinationId != null && !destinationId.isBlank()
                    && destinationFingerprint != null && !destinationFingerprint.isBlank()
                    && destinationCiphertext != null && !destinationCiphertext.isBlank()
                    && destinationKeyVersion != null && destinationKeyVersion > 0
                    && destinationAlgorithm != null && !destinationAlgorithm.isBlank()
                    && bankAccountLast4 != null && !bankAccountLast4.isBlank();
        }
    }

    private static final RowMapper<LegacySellerRow> LEGACY_SELLER_ROW_MAPPER = (ResultSet rs, int rowNum) ->
            new LegacySellerRow(
                    rs.getLong("id"),
                    rs.getString("bank_name"),
                    rs.getString("bank_account"),
                    rs.getString("destination_id"),
                    rs.getString("destination_fingerprint"),
                    rs.getString("destination_ciphertext"),
                    (Integer) rs.getObject("destination_key_version"),
                    rs.getString("destination_algorithm"),
                    rs.getString("bank_account_last4"),
                    rs.getString("verification_state"));
}
