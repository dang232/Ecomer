import { getTraceEndpoint } from './tracing';

describe('cart tracing endpoint', () => {
  const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    } else {
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = originalEndpoint;
    }
  });

  it('uses the configured OTLP HTTP endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      'http://jaeger:4318/v1/traces';

    expect(getTraceEndpoint()).toBe('http://jaeger:4318/v1/traces');
  });
});
