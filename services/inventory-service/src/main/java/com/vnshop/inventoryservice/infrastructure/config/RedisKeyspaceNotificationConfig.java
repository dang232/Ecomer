package com.vnshop.inventoryservice.infrastructure.config;

import com.vnshop.inventoryservice.infrastructure.event.ReservationExpiryListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Configures Redis keyspace notifications so that expired {@code vnshop:flash-sale:v1:reservation:*}
 * keys trigger {@link ReservationExpiryListener}.
 *
 * <p>The Redis server must have keyspace notifications enabled:
 * {@code notify-keyspace-events "Ex"}. This can be set in {@code redis.conf}
 * or via {@code CONFIG SET notify-keyspace-events Ex} at runtime.
 */
@Configuration
public class RedisKeyspaceNotificationConfig {

    /**
     * Listens on the {@code __keyevent@*__:expired} pattern so expiry events
     * from any Redis DB index are captured.
     */
    @Bean
    public RedisMessageListenerContainer redisKeyspaceListenerContainer(
            RedisConnectionFactory connectionFactory,
            ReservationExpiryListener reservationExpiryListener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(
            reservationExpiryListener,
            new PatternTopic("__keyevent@*__:expired")
        );
        return container;
    }
}
