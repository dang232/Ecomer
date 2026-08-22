import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: getTraceEndpoint(),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

export function getTraceEndpoint(): string {
  return (
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    "http://jaeger:4318/v1/traces"
  );
}

export function startTracing(): void {
  sdk.start();
  console.log("OpenTelemetry tracing started (OTLP HTTP exporter)");
}
