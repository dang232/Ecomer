package com.vnshop.userservice.infrastructure.storage;

import java.net.URI;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
@ConditionalOnProperty(prefix = "vnshop.user-storage", name = "enabled", havingValue = "true")
public class ObjectStorageConfig {
    @Bean
    S3Client avatarS3Client(ObjectStorageProperties properties) {
        return S3Client.builder()
                .region(Region.of(properties.getRegion()))
                .endpointOverride(URI.create(properties.getEndpoint()))
                .credentialsProvider(credentialsProvider(properties))
                .serviceConfiguration(serviceConfiguration(properties))
                .build();
    }

    @Bean
    S3Presigner avatarS3Presigner(ObjectStorageProperties properties) {
        // Presigner uses the publicEndpoint so the browser can PUT directly.
        // The internal S3Client uses the docker-network endpoint for ops
        // that the BE runs itself (headObject, deleteObject).
        return S3Presigner.builder()
                .region(Region.of(properties.getRegion()))
                .endpointOverride(URI.create(properties.resolvePublicEndpoint()))
                .credentialsProvider(credentialsProvider(properties))
                .serviceConfiguration(serviceConfiguration(properties))
                .build();
    }

    @Bean
    S3ObjectStorageAdapter s3ObjectStorageAdapter(S3Client avatarS3Client, S3Presigner avatarS3Presigner, ObjectStorageProperties properties) {
        return new S3ObjectStorageAdapter(avatarS3Client, avatarS3Presigner, properties);
    }

    private StaticCredentialsProvider credentialsProvider(ObjectStorageProperties properties) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey()));
    }

    private S3Configuration serviceConfiguration(ObjectStorageProperties properties) {
        return S3Configuration.builder()
                .pathStyleAccessEnabled(properties.isPathStyleAccess())
                .build();
    }
}
