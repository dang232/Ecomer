package com.vnshop.transcoder.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3AsyncClient;

import java.net.URI;
import java.time.Duration;

@Configuration
@EnableConfigurationProperties(S3Properties.class)
public class S3Config {

    @Bean
    public S3AsyncClient s3AsyncClient(S3Properties properties) {
        var builder = S3AsyncClient.builder()
                .region(Region.of(properties.region()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
                .overrideConfiguration(b -> b
                        .putHeader("Accept", "application/json"));

        if (properties.endpoint() != null && !properties.endpoint().isBlank()) {
            // MinIO / localstack override
            builder.endpointOverride(URI.create(properties.endpoint()))
                   .forcePathStyle(true);
        }

        return builder.build();
    }
}
