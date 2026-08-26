import { propagation, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  extractKafkaContext,
  injectKafkaContext,
} from "./kafka-trace-propagation";

describe("Kafka trace propagation", () => {
  beforeAll(() => {
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });
  it("injects W3C headers without changing the message payload", () => {
    const spanContext = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: 1,
      isRemote: false,
    });
    const headers = injectKafkaContext({}, spanContext);

    expect(headers.traceparent?.toString()).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
  });

  it("extracts W3C headers from a Kafka message", () => {
    const extracted = extractKafkaContext({
      key: null,
      value: Buffer.from("{}"),
      headers: {
        traceparent: Buffer.from(
          "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        ),
      },
      timestamp: "0",
      attributes: 0,
      offset: "0",
    });

    const roundTripped = injectKafkaContext({}, extracted);
    expect(roundTripped.traceparent?.toString()).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
  });
});
