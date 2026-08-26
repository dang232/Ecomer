import { Counter, Gauge, Histogram } from 'prom-client';

export const httpServerRequestsSeconds = new Histogram({
  name: 'http_server_requests_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'status', 'route'],
});

export const redisEvictionsTotal = new Counter({
  name: 'redis_evictions_total',
  help: 'Redis cache entries evicted or invalidated by the cart service.',
  labelNames: ['operation', 'outcome'],
});

export const redisCacheHitsTotal = new Counter({
  name: 'cart_cache_hits_total',
  help: 'Cart Redis cache hits.',
});

export const redisCacheMissesTotal = new Counter({
  name: 'cart_cache_misses_total',
  help: 'Cart Redis cache misses.',
});

export const redisOperationDurationSeconds = new Histogram({
  name: 'cart_redis_operation_duration_seconds',
  help: 'Cart Redis operation duration in seconds.',
  labelNames: ['operation'],
});

export const redisEvictionGauge = new Gauge({
  name: 'redis_evictions_current',
  help: 'Current observed Redis eviction count, when Redis exposes it.',
});
