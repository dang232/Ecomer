"""Authenticated Kafka reliability smoke fixture for CI service containers."""

from __future__ import annotations

import argparse
import json
import os
import socket
import time
from dataclasses import dataclass

from kafka import KafkaConsumer, KafkaProducer
from kafka.admin import KafkaAdminClient, NewTopic
from kafka.errors import KafkaError


@dataclass(frozen=True)
class FixtureConfig:
    brokers: str
    username: str
    password: str
    group: str
    topic_prefix: str


def config_from_environment() -> FixtureConfig:
    values = {
        "brokers": os.environ.get("RELIABILITY_KAFKA_BROKERS", "").strip(),
        "username": os.environ.get("RELIABILITY_KAFKA_USERNAME", "").strip(),
        "password": os.environ.get("RELIABILITY_KAFKA_PASSWORD", "").strip(),
        "group": os.environ.get("RELIABILITY_KAFKA_GROUP", "reliability-fixture").strip(),
        "topic_prefix": os.environ.get("RELIABILITY_TOPIC_PREFIX", "reliability").strip(),
    }
    missing = [name for name in ("brokers", "username", "password") if not values[name]]
    if missing:
        raise ValueError(f"missing Kafka fixture settings: {', '.join(missing)}")
    return FixtureConfig(**values)


def kafka_options(config: FixtureConfig) -> dict[str, object]:
    return {
        "bootstrap_servers": config.brokers.split(","),
        "security_protocol": "SASL_PLAINTEXT",
        "sasl_mechanism": "PLAIN",
        "sasl_plain_username": config.username,
        "sasl_plain_password": config.password,
        "request_timeout_ms": 3000,
    }


def topics(config: FixtureConfig) -> tuple[str, ...]:
    return tuple(
        f"{config.topic_prefix}.{service}.{kind}"
        for service in ("order", "payment", "notification", "search", "invoice", "video")
        for kind in ("events", "retry", "DLT")
    )


def ensure_topics(config: FixtureConfig) -> None:
    admin = KafkaAdminClient(**kafka_options(config), client_id="reliability-admin")
    try:
        existing = set(admin.list_topics())
        pending = [
            NewTopic(name=topic, num_partitions=1, replication_factor=1)
            for topic in topics(config)
            if topic not in existing
        ]
        if pending:
            admin.create_topics(pending, validate_only=False)
    finally:
        admin.close()


def consume_one(config: FixtureConfig, topic: str, timeout_ms: int = 5000) -> list[dict[str, object]]:
    consumer = KafkaConsumer(
        topic,
        **kafka_options(config),
        group_id=f"{config.group}-{topic}",
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )
    try:
        deadline = time.monotonic() + timeout_ms / 1000
        records: list[dict[str, object]] = []
        while time.monotonic() < deadline and not records:
            for messages in consumer.poll(timeout_ms=250).values():
                records.extend(message.value for message in messages)
        return records
    finally:
        consumer.close()


def duplicate_delivery(config: FixtureConfig) -> None:
    source = f"{config.topic_prefix}.order.events"
    producer = KafkaProducer(
        **kafka_options(config),
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
    )
    try:
        payload = {"eventId": f"duplicate-{time.time_ns()}", "orderId": "fixture-order"}
        producer.send(source, key=b"fixture-order", value=payload)
        producer.send(source, key=b"fixture-order", value=payload)
        producer.flush(timeout=5)
    finally:
        producer.close()
    records = consume_one(config, source)
    if len(records) != 2 or records[0] != records[1]:
        raise AssertionError(f"duplicate delivery fixture expected two equal records, got {records!r}")


def malformed_to_dlt(config: FixtureConfig) -> None:
    source = f"{config.topic_prefix}.video.events"
    dlt = f"{config.topic_prefix}.video.DLT"
    producer = KafkaProducer(**kafka_options(config))
    try:
        producer.send(source, key=b"malformed", value=b"not-json")
        producer.flush(timeout=5)
    finally:
        producer.close()
    consumer = KafkaConsumer(
        source,
        **kafka_options(config),
        group_id=f"{config.group}-malformed",
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )
    dlt_producer = KafkaProducer(**kafka_options(config))
    try:
        raw = next(iter(consumer.poll(timeout_ms=5000).values()))[0].value
        for _ in range(3):
            try:
                json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                continue
        dlt_producer.send(dlt, key=b"malformed", value=raw).get(timeout=5)
    finally:
        consumer.close()
        dlt_producer.close()
    dlt_consumer = KafkaConsumer(
        dlt,
        **kafka_options(config),
        group_id=f"{config.group}-dlt-assert",
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )
    try:
        if not any(message.value == b"not-json" for values in dlt_consumer.poll(timeout_ms=5000).values() for message in values):
            raise AssertionError("malformed payload did not reach DLT")
    finally:
        dlt_consumer.close()


def broker_down() -> None:
    endpoint = os.environ.get("RELIABILITY_BROKER_DOWN_ENDPOINT", "127.0.0.1:1")
    host, port_text = endpoint.rsplit(":", 1)
    started = time.monotonic()
    try:
        with socket.create_connection((host, int(port_text)), timeout=2):
            raise AssertionError(f"broker-down endpoint unexpectedly accepted a connection: {endpoint}")
    except OSError:
        elapsed = time.monotonic() - started
        if elapsed > 3:
            raise AssertionError(f"broker-down fixture exceeded 3 seconds: {elapsed:.3f}s")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("case", choices=("all", "duplicate-delivery", "malformed-dlt", "broker-down"))
    args = parser.parse_args()
    if args.case == "broker-down":
        broker_down()
        return
    config = config_from_environment()
    ensure_topics(config)
    if args.case in ("all", "duplicate-delivery"):
        duplicate_delivery(config)
    if args.case in ("all", "malformed-dlt"):
        malformed_to_dlt(config)


if __name__ == "__main__":
    main()
