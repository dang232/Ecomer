package com.vnshop.transcoder;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.retry.annotation.EnableRetry;

@SpringBootApplication
@EnableRetry
public class TranscoderApplication {

    public static void main(String[] args) {
        SpringApplication.run(TranscoderApplication.class, args);
    }
}
