-- Atomically reserve flash-sale stock and bind the result to an idempotency key.
-- KEYS[1] = stock
-- KEYS[2] = active buyers
-- KEYS[3] = idempotency record
-- KEYS[4] = reservation record
-- KEYS[5] = expiration index
-- ARGV[1] = requested quantity
-- ARGV[2] = buyerId
-- ARGV[3] = reservationId
-- ARGV[4] = requestHash
-- ARGV[5] = reservedAt
-- ARGV[6] = expiresAt ISO-8601
-- ARGV[7] = reservation storage TTL seconds
-- ARGV[8] = idempotency TTL seconds
-- ARGV[9] = expiresAt epoch millis
local existingHash = redis.call('HGET', KEYS[3], 'requestHash')
if existingHash then
  return 2
end

if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
  return 3
end

local stock = tonumber(redis.call('GET', KEYS[1]) or '0')
if stock >= tonumber(ARGV[1]) then
  redis.call('DECRBY', KEYS[1], ARGV[1])
  redis.call('SADD', KEYS[2], ARGV[2])
  redis.call('HSET', KEYS[4],
    'reservationId', ARGV[3],
    'productId', string.sub(KEYS[1], string.len('vnshop:flash-sale:v1:stock:') + 1),
    'buyerId', ARGV[2],
    'quantity', ARGV[1],
    'status', 'RESERVED',
    'reservedAt', ARGV[5],
    'expiresAt', ARGV[6])
  redis.call('EXPIRE', KEYS[4], ARGV[7])
  redis.call('ZADD', KEYS[5], ARGV[9], ARGV[3])
  redis.call('HSET', KEYS[3], 'requestHash', ARGV[4], 'reservationId', ARGV[3])
  redis.call('EXPIRE', KEYS[3], ARGV[8])
  return 1
else
  return 0
end
