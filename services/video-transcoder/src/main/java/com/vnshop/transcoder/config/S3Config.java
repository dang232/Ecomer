package com.vnshop.transcoder.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;

import java.net.URI;
import java.time.Duration;

@Configuration
public class S3Config {

    @Value("${vnshop.s3.endpoint:}")
    private String endpoint;

    @Value("${vnshop.s3.region:us-east-1}")
    private String region;

    @Value("${vnshop.s3.access-key:minioadmin}")
    private String accessKey;

    @Value("${vnshop.s3.secret-key:minioadmin}")
    private String secretKey;

    @Bean
    public S3AsyncClient s3AsyncClient() {
        var builder = S3AsyncClient.builder()
                .region(Region.of(region))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)))
                .overrideConfiguration(b -> b
                        // Netty async executor with proper thread pool sizing
                        .putHttpClientProperties(cp -> cp
                                .maxConcurrency(100)
                                .connectionTimeout(Duration.ofSeconds(30))
                                .readTimeout(Duration.ofSeconds(60))));

        if (!endpoint.isBlank()) {
            // MinIO / localstack override
            builder.endpointOverride(URI.create(endpoint))
                   .forcePathStyle(true);
        }

        return builder.build();
    }
}
