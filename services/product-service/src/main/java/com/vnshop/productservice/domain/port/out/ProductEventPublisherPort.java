package com.vnshop.productservice.domain.port.out;

import com.vnshop.productservice.domain.ProductEvent;
import java.util.concurrent.CompletableFuture;
import org.springframework.kafka.support.SendResult;

public interface ProductEventPublisherPort {
    CompletableFuture<SendResult<String, ProductEvent>> publish(ProductEvent event);
}
