package com.vnshop.sellerfinanceservice.infrastructure.config;

import com.vnshop.sellerfinanceservice.application.CapturePayoutDestinationSnapshotUseCase;
import com.vnshop.sellerfinanceservice.application.SealPayoutDestinationSnapshotUseCase;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.CipherPort;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutDestinationClient;
import com.vnshop.sellerfinanceservice.infrastructure.crypto.AesGcmCipher;
import com.vnshop.sellerfinanceservice.infrastructure.crypto.HmacSnapshotSealer;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import javax.crypto.SecretKey;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires seller-finance cipher + snapshot sealer + capture use cases
 * with fail-closed key loading.
 *
 * <p>Keys are sourced from env vars:
 * {@code VNSHOP_PAYOUT_DESTINATION_KEY_V<version>=<base64-32-bytes>}
 * for both cipher and sealer. Missing keys fail bean creation,
 * causing the whole service to refuse to start.
 *
 * <p>Test configurations override {@link CipherPort},
 * {@link SnapshotSealer}, or {@link PayoutDestinationClient} via
 * {@code @TestConfiguration} without touching this wiring.
 */
@Configuration
public class DestinationCryptoConfig {

    @Bean
    CipherPort payoutDestinationCipher() {
        Map<Integer, SecretKey> keys = loadCipherKeys();
        return new AesGcmCipher(keys);
    }

    @Bean
    SnapshotSealer payoutSnapshotSealer() {
        Map<Integer, byte[]> keys = loadSealerKeys();
        return new HmacSnapshotSealer(keys);
    }

    @Bean
    CapturePayoutDestinationSnapshotUseCase capturePayoutDestinationSnapshotUseCase(
            PayoutDestinationClient client) {
        return new CapturePayoutDestinationSnapshotUseCase(client);
    }

    @Bean
    SealPayoutDestinationSnapshotUseCase sealPayoutDestinationSnapshotUseCase(SnapshotSealer sealer) {
        return new SealPayoutDestinationSnapshotUseCase(sealer);
    }

    private static Map<Integer, SecretKey> loadCipherKeys() {
        Map<Integer, SecretKey> out = new HashMap<>();
        for (Map.Entry<Integer, String> e : scanEnvKeyVersions().entrySet()) {
            out.put(e.getKey(), AesGcmCipher.decodeBase64Key(e.getValue()));
        }
        if (out.isEmpty()) {
            throw new IllegalStateException(
                    "no payout-destination cipher keys configured. "
                            + "Set VNSHOP_PAYOUT_DESTINATION_KEY_V1 (base64-encoded 32 bytes).");
        }
        return out;
    }

    private static Map<Integer, byte[]> loadSealerKeys() {
        Map<Integer, byte[]> out = new HashMap<>();
        for (Map.Entry<Integer, String> e : scanEnvKeyVersions().entrySet()) {
            out.put(e.getKey(), java.util.Base64.getDecoder().decode(e.getValue()));
        }
        if (out.isEmpty()) {
            throw new IllegalStateException(
                    "no payout-snapshot sealer keys configured. "
                            + "Set VNSHOP_PAYOUT_DESTINATION_KEY_V1 (base64-encoded 32 bytes).");
        }
        return out;
    }

    private static Map<Integer, String> scanEnvKeyVersions() {
        Map<Integer, String> result = new HashMap<>();
        // First, look at Spring properties (or -D system properties) so tests
        // and dev runs can inject keys without polluting real environment.
        for (String name : System.getProperties().stringPropertyNames()) {
            if (name.startsWith("vnshop.payout-destination.key.v")) {
                String tail = name.substring("vnshop.payout-destination.key.v".length());
                try {
                    int version = Integer.parseInt(tail);
                    result.put(version, System.getProperty(name));
                } catch (NumberFormatException ignored) {
                    // non-numeric suffix; skip silently
                }
            }
        }
        // Then, fall back to OS environment variables for production.
        Set<String> envKeys = System.getenv().keySet();
        for (String name : envKeys) {
            if (name.startsWith("VNSHOP_PAYOUT_DESTINATION_KEY_V")) {
                String tail = name.substring("VNSHOP_PAYOUT_DESTINATION_KEY_V".length());
                try {
                    int version = Integer.parseInt(tail);
                    result.put(version, System.getenv(name));
                } catch (NumberFormatException ignored) {
                    // non-numeric suffix; skip silently
                }
            }
        }
        return result;
    }
}