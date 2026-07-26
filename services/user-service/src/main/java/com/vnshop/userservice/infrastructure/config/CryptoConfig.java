package com.vnshop.userservice.infrastructure.config;

import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import com.vnshop.userservice.infrastructure.crypto.AesGcmDestinationCipher;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * Wires the AES-256-GCM destination cipher from configuration.
 *
 * <p>Key material is supplied via env vars:
 * {@code VNSHOP_PAYOUT_DESTINATION_KEY_V1=<base64-32-bytes>},
 * {@code VNSHOP_PAYOUT_DESTINATION_KEY_V2=...}, ... and
 * {@code vnshop.crypto.payout.default-key-version=<n>}.
 *
 * <p>Missing / invalid / zero-length keys cause the cipher to fail
 * closed at startup: the bean is never created, the service refuses
 * to handle payout destination enrollment or lookup, and the missing
 * key is loud at boot time.
 *
 * <p>Tests can override the bean using a different CipherPort
 * implementation registered via {@code @TestConfiguration}.
 */
@Configuration
@EnableConfigurationProperties({PayoutCryptoProperties.class, PayoutBackfillProperties.class})
public class CryptoConfig {

    @Bean
    CipherPort payoutDestinationCipher(
            Environment env,
            PayoutCryptoProperties properties
    ) {
        Map<Integer, String> keysByVersion = scanKeyVersions(env, properties);
        if (keysByVersion.isEmpty()) {
            throw new IllegalStateException(
                    "no payout-destination encryption keys configured. Set "
                            + "VNSHOP_PAYOUT_DESTINATION_KEY_V1 (256-bit AES, base64-encoded).");
        }
        int defaultKeyVersion = properties.defaultKeyVersion();
        if (!keysByVersion.containsKey(defaultKeyVersion)) {
            throw new IllegalStateException(
                    "default key version " + defaultKeyVersion
                            + " is not present in configured key set " + keysByVersion.keySet());
        }
        return new AesGcmDestinationCipher(keysByVersion, defaultKeyVersion);
    }

    /**
     * Probes v1..v32 under both the Spring property prefix and the OS env
     * prefix. Probing a fixed range is portable across Spring versions
     * (no dependency on {@code Environment.getPropertyNames()}, which is
     * not on the {@code Environment} interface in Spring 6/7). The probe
     * ceiling is high enough that realistic key-rotation schemes fit
     * without needing a dynamic enumeration.
     */
    private static Map<Integer, String> scanKeyVersions(
            Environment env,
            PayoutCryptoProperties properties) {
        Map<Integer, String> result = new HashMap<>();
        for (int v = 1; v <= properties.maxKeyVersion(); v++) {
            String fromProps = env.getProperty(properties.keyPropertyPrefix() + v);
            if (fromProps != null && !fromProps.isBlank()) {
                result.put(v, fromProps);
            }
            String fromEnv = System.getenv(properties.keyEnvPrefix() + v);
            if (fromEnv != null && !fromEnv.isBlank()) {
                result.put(v, fromEnv);
            }
        }
        return result;
    }
}
