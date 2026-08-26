import {
  context,
  type Context,
  type TextMapGetter,
  type TextMapSetter,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import type { IHeaders, KafkaMessage } from "kafkajs";

type KafkaHeaders = IHeaders;

export function injectKafkaContext(
  headers: KafkaHeaders,
  carrierContext: Context = context.active(),
): KafkaHeaders {
  const setter: TextMapSetter<KafkaHeaders> = {
    set(carrier, key, value) {
      carrier[key] = Buffer.from(value, "utf8");
    },
  };
  new W3CTraceContextPropagator().inject(carrierContext, headers, setter);
  return headers;
}

export function extractKafkaContext(message: KafkaMessage): Context {
  const getter: TextMapGetter<KafkaHeaders> = {
    keys: (carrier) => Object.keys(carrier),
    get: (carrier, key) => {
      const value = carrier[key];
      if (value === undefined) return undefined;
      if (Array.isArray(value)) return value[0]?.toString("utf8");
      return value.toString("utf8");
    },
  };
  return new W3CTraceContextPropagator().extract(
    context.active(),
    message.headers,
    getter,
  );
}
