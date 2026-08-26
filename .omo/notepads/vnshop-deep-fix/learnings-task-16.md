# Task 16: Durable DLT and jittered retries

- Recommendations and seller-finance fixed backoff handlers now use bounded exponential backoff with ThreadLocalRandom jitter in the 0.8x-1.2x range and a 30s ceiling.
- Video moderation production consumption uses an asyncio Queue plus executor-backed worker pool; retry waits use asyncio.sleep and do not block the event loop. Settings validation is fail-closed when loaded by get_settings, while direct unit-test Settings construction remains usable.
- Payment-service already had the durable DLT foundation; replay now returns 409 for an already replayed row and 202 from the admin endpoint. Order, invoice, and seller-finance now persist DLT records in service-owned dlt_store tables and expose admin-only replay routes where wired.
- Focused payment, invoice, recommendations, seller-finance, and Python tests/compiles pass. The requested order test is blocked by unrelated pre-existing compilation failures in the dirty worktree; evidence is recorded in task-16-vnshop-deep-fix.log.
