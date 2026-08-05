package com.vnshop.productservice.infrastructure.storage;

import java.net.URI;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
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
@EnableConfigurationProperties(ObjectStorageProperties.class)
@ConditionalOnProperty(prefix = "vnshop.object-storage", name = "enabled", havingValue = "true")
public class ObjectStorageConfig {
    @Bean
    S3Client s3Client(ObjectStorageProperties properties) {
        return S3Client.builder()
                .region(Region.of(properties.getRegion()))
                .endpointOverride(URI.create(properties.getEndpoint()))
                .credentialsProvider(credentialsProvider(properties))
                .serviceConfiguration(serviceConfiguration(properties))
                .build();
    }

    @Bean
    S3Presigner s3Presigner(ObjectStorageProperties properties) {
        return S3Presigner.builder()
                .region(Region.of(properties.getRegion()))
                .endpointOverride(URI.create(properties.resolvePublicEndpoint()))
                .credentialsProvider(credentialsProvider(properties))
                .serviceConfiguration(serviceConfiguration(properties))
                .build();
    }

    @Bean
    S3ObjectStorageAdapter s3ObjectStorageAdapter(
            S3Client s3Client,
            S3Presigner s3Presigner,
            ObjectStorageProperties properties,
            VideoStorageProperties videoStorageProperties) {
        return new S3ObjectStorageAdapter(s3Client, s3Presigner, properties, videoStorageProperties);
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
