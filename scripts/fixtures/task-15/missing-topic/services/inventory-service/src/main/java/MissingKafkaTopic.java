package fixture;

import org.springframework.kafka.annotation.KafkaListener;

final class MissingKafkaTopic {
    @KafkaListener(topics = "inventory.topic.missing", groupId = "fixture")
    void consume(String payload) {
    }
}
