package com.vnshop.productservice.infrastructure.storage;

import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import java.io.InputStream;
import java.net.URI;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fallback {@link ObjectStoragePort} for environments where S3/MinIO is not
 * configured (local dev, CI). Returns deterministic placeholder URIs so use
 * cases that depend on the port still wire, but nothing actually leaves the
 * process. The real {@code S3ObjectStorageAdapter} bean takes precedence when
 * {@code vnshop.object-storage.enabled=true} is set.
 */
@Configuration
public class ObjectStorageNoopConfig {

    @Bean
    @ConditionalOnMissingBean(ObjectStoragePort.class)
    ObjectStoragePort noopObjectStoragePort() {
        return new NoopObjectStoragePort();
    }

    static final class NoopObjectStoragePort implements ObjectStoragePort {
        private static final URI PLACEHOLDER = URI.create("about:blank");

        @Override
        public void putObject(String key, InputStream content, ObjectMetadata metadata) {
        }

        @Override
        public URI getSignedUploadUrl(String key, ObjectMetadata metadata) {
            return PLACEHOLDER;
        }

        @Override
        public URI getSignedDownloadUrl(String key, ObjectStorageClass storageClass) {
            return PLACEHOLDER;
        }

        @Override
        public URI publicUrl(String key) {
            return PLACEHOLDER;
        }

        @Override
        public void deleteObject(String key) {
        }

        @Override
        public void copyObject(String sourceKey, String destinationKey) {
        }

        @Override
        public Optional<ObjectMetadata> headObject(String key) {
            return Optional.empty();
        }
    }
}
