-- Release an unexpired/expired reservation back to flash-sale stock exactly once.
-- KEYS[1] = stock
-- KEYS[2] = reservation
-- KEYS[3] = active buyers
-- KEYS[4] = expiration index
-- ARGV[1] = quantity to restore
-- ARGV[2] = buyerId
if redis.call('EXISTS', KEYS[2]) == 1 then
  redis.call('INCRBY', KEYS[1], ARGV[1])
  redis.call('DEL', KEYS[2])
  redis.call('SREM', KEYS[3], ARGV[2])
  redis.call('ZREM', KEYS[4], string.sub(KEYS[2], string.len('vnshop:flash-sale:v1:reservation:') + 1))
  return 1
else
  return 0
end
