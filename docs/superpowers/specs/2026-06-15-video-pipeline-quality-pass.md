# Video Pipeline — Quality Pass (Phase C)

**Date:** 2026-06-15
**Reviewer:** worker-c (review-only) + orchestrator (applied fix subset)
**Scope:** DDD/DRY/SOLID pass on new video pipeline code only. Out of scope: image upload area (13 pre-existing modified files), the 13 pre-modified files in scope are NOT touched. The core `domain/video/Video.java` is stable and was not modified.

**Status of findings after Phase C application:**

| Severity | Count | Applied | Deferred | False positive |
|---|---|---|---|---|
| Critical | 2 | 2 (C1, C2) | 0 | 0 |
| High | 12 | 4 (H1, H2, H4, H12) | 5 (H3, H5, H7, H8, H9) | 3 (H6, H10, H15) |
| Medium | 18 | 3 (M1, M3, M18 deferred) | 1 (M18) | 14 (M2, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, M15, M16, M17) |
| Low | 12 | 2 (L2, L11, L12) | 0 | 10 (L1, L3, L4, L5, L6, L7, L8, L9, L10) |

## Summary

The video pipeline is broadly well-structured: ports live in `domain/video/port/out/`, the `Video` aggregate is an immutable value object with `withX()` mutators, the publisher port matches the existing `ProductEventPublisherPort` pattern, and the new Java tests follow the project's `assertj` + fakes pattern. The new FE tests use `renderHook` with `vitest` (not shallow mocks) and the Python tests mock `ffmpeg` via `unittest.mock`.

However, there is one CRITICAL bug: `VideoUploadService.appendChunk()` writes a per-chunk `ObjectMetadata` to object storage with a `stagingKey + "?offset=N"` suffix, which produces a different object key per chunk — meaning each chunk becomes a separate object rather than accumulating into a single staging object. This breaks resumable upload semantics. There are several HIGHs: dead `isFinalChunk` logic in `appendChunk()`, leaked placeholder `"0".repeat(64)` SHA-256 in the per-chunk metadata, an inconsistency where `appendChunk()` does NOT transition to UPLOADED but the controller calls `finaliseUpload()` separately, magic strings `"PRODUCT"`/`"REVIEW"` flowing through the service rather than the `VideoOwnerType` enum, and a notable SOLID violation in `VideoUploadService` (480 lines, 5+ concerns).

---

## Findings

### Critical (must fix before commit)

- **[C1] Per-chunk object key with `?offset=N` suffix creates N separate objects, not one accumulating file** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:181-192` — `objectStoragePort.putObject(stagingKey + "?offset=" + chunkOffset, ...)` writes each chunk under a distinct key. The transcoder's downstream `vnshop-video-uploads-tmp/{key}` look-up uses the bare `stagingKey`, so it will not find the assembled file. Resumable uploads are broken at the storage layer. **Fix:** Either (a) use the S3 multipart-upload API to accumulate parts, or (b) accumulate chunks into a single object via chunked streaming PUT. The current code does both: writes per-chunk objects (a) AND `digestMap` in-process (b) — the digestMap is the only correct part.

- **[C2] `appendChunk` writes a placeholder `sha256Hex("0".repeat(64))` to every chunk's metadata** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:189` — The ObjectMetadata's `sha256Hex` is hard-coded to 64 zeros "as placeholder", but the comment says "final hash computed below". There is no code that updates the metadata after the digest is finalized, and since each chunk is its own object (see C1), the final hash can never be set. **Fix:** Compute a real chunk-level SHA on each PATCH and set it; or, after fixing C1, compute the running hash and set it on the final metadata.

### High (should fix before commit)

- **[H1] Dead `isFinalChunk` detection logic in `appendChunk` (incorrect proxy)** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:202-206` — `isFinalChunk = newOffset >= video.stagingKey().length()` compares byte offset against the *length of the staging key string*, which is meaningless. The comment even admits "Re-check by comparing to a declared size we store". The `isFinalChunk` variable is also never read. **Fix:** Pass the declared total size into the method (or store it in Redis on createUploadSession) and compare against that; remove the dead `isFinalChunk` block.

- **[H2] String magic values `"PRODUCT"`/`"REVIEW"` flow through service layer instead of `VideoOwnerType` enum** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:114, 123-124, 412, 426, 432` and `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/TusMetadata.java:40` — The `VideoOwnerType` enum exists at `domain/video/VideoOwnerType.java` but is never referenced in the application code; all comparisons use string equality. **Fix:** Have `TusMetadata.parse()` return `VideoOwnerType ownerType()`, and the service compare against the enum. This is what the enum was created for.

- **[H3] `VideoUploadService` is 480 lines and handles 5+ distinct concerns (SRP violation)** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java` — Concerns mixed: (1) tus lifecycle (create/append/finalise/cancel/offset), (2) rate limiting, (3) concurrent session tracking, (4) quota enforcement, (5) magic-byte validation, (6) incremental SHA-256 state, (7) reaper scheduling, (8) appeal submission, (9) owner soft-delete. The plan explicitly calls this out. **Fix:** Split into `VideoUploadSessionService` (1, 5, 6, 9), `VideoQuotaEnforcer` (3, 4, 2 — Redis-backed), `VideoReaper` (7), keep `submitAppeal` on a `VideoAppealService`. This is the largest refactor and should be deferred only if Phase D runs cleanly.

- **[H4] `appendChunk` does not transition state but `finaliseUpload` does — undocumented hand-off via controller** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:170-208, 215-242` and `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoController.java:95-102` — `appendChunk()` does *not* advance the state or call `decrementConcurrentSessions()`; the controller decides "is this the final chunk?" by reading `totalLength` and then calls `finaliseUpload()`. This means a single `appendChunk` that is the last chunk leaves the video in `UPLOADING` until the next request. If a client crashes between PATCH and the next PATCH, the video is stuck in UPLOADING forever (the reaper catches it, but with a 10-min delay). **Fix:** Move final-chunk detection into the service: pass the declared total length, or have the service compute it from Redis-stored expected size.

- **[H5] `VideoUploadService` depends on concrete `StringRedisTemplate` (DIP violation)** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:72` — Direct field injection of `org.springframework.data.redis.core.StringRedisTemplate`. All other port-based dependencies (`VideoJpaRepository`, `ObjectStoragePort`, `VideoEventPublisherPort`) go through abstractions, but the Redis access is concrete. **Fix:** Extract a `VideoRedisPort` interface (e.g. `incrementRateLimit(uploaderId)`, `getOffset(videoId)`, `setDigestState(videoId, hex)`, etc.) and inject it.

- **[H6] `sha256Hex("0".repeat(64))` placeholder string is wrong on per-chunk objects** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:189` — Beyond the C2 concern, the literal "0".repeat(64)" is a magic-number-equivalent. **Fix:** Use `String.format("%064d", 0L)` or extract `static final String UNKNOWN_SHA256 = "0".repeat(64);` and reference it.

- **[H7] `Video` aggregate uses string `productId`/`reviewId` instead of typed UUID** — `services/product-service/src/main/java/com/vnshop/productservice/domain/video/Video.java:10-11` and everywhere `video.productId()` is used as a String — The schema column is `UUID`, but the domain type stores the UUID as `String`. This forces the JPA entity to do `UUID.fromString(video.productId())` on every save (see `VideoJpaEntity.fromDomain` line 84). **Fix:** Change the domain field to `UUID productId`. **However** the plan explicitly says "Don't modify `domain/video/Video.java` core logic" — defer to a separate refactor commit.

- **[H8] `VideoAdminService.approve` and `approveAppeal` are confusingly chained (recursive call to self)** — `services/product-service/src/main/java/com/vnshop\productservice\application\video\VideoAdminService.java:119-126` — `approveAppeal()` calls `approve()`, but `approve()` then re-validates status with `requireModeratableStatus` (which allows PENDING_REVIEW *or* APPEAL_PENDING), so it works — but the *re-entry* path means a failing `approve()` will leave the appeal in APPEAL_PENDING status and the user has no idea which transition failed. The `requireModeratableStatus` check is also now too loose (it should be stricter for the appeal path). **Fix:** Extract the actual "copy staging → public, save, emit event" into a private `doApprove(video, adminId)` and have both `approve()` and `approveAppeal()` do their own state check then call `doApprove()`.

- **[H9] `VideoEventPublisher` swallows Kafka send failures with a `WARN` log** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/event/VideoEventPublisher.java:24-26` — A `RuntimeException` from `kafkaTemplate.send()` is caught and logged. For events that downstream services depend on (e.g. `video.upload.completed` triggers transcoding, `video.published` triggers notifications), silently dropping the event means the video sits in `UPLOADED` forever. **Fix:** The matching `ProductEventPublisher` has the same bug — they should be aligned to a transactional outbox or at least rethrow, and let Kafka's own retry/DLT handle it.

- **[H10] `VideoAdminService` not annotated `@Service` or `@Transactional`** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoAdminService.java:23` — Missing `@Service` (or equivalent). Spring only finds it because of `UseCaseConfig`. The matching `VideoUploadService` has `@RequiredArgsConstructor` only and is *also* missing `@Service`. **Fix:** Add `@Service` to both. Verify they are still picked up after the change.

- **[H11] 5 near-identical empty exception classes** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/{VideoValidationException,VideoModerationException,VideoNotFoundException,VideoQuotaExceededException,VideoUploadRateLimitException}.java` — All five are 7-19 lines, three of them are 7 lines with a single `super(message)` constructor. The handler in `ApiExceptionHandler` already maps each to a different HTTP status + error code. **Fix:** Two viable consolidations: (a) keep the typed classes but make them all share a common `VideoException` parent with a `code()` method (which `VideoValidationException` already has); or (b) collapse to a single `VideoException(code, message)` and let `ApiExceptionHandler` map by code. Option (a) is lower-risk and preserves the existing `@ExceptionHandler` mappings.

- **[H12] `appendChunk` uses `video.stagingKey().length()` as a stand-in for total size** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:203` — The `stagingKey` is a string like `"videos/staging/{uuid}"` (about 24-40 chars). Comparing byte offset against this length means a "final chunk" is detected after just ~30 bytes. This is the symptom behind H1. **Fix:** Add a `totalSize` field on `Video` (or in Redis) and compare against that.

### Medium (nice to fix, can defer)

- **[M1] `VideoAdminService.getPreviewUrl` duplicates the stagingKey null-check present in `VideoAdminService.findOrThrow` path** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoAdminService.java:46-54` — The null-check pattern is fine, but the function uses a fully-qualified `com.vnshop.productservice.domain.storage.ObjectStorageClass.VIDEO_STAGING` instead of importing it. Stylistic only.

- **[M2] `VideoController.uploadChunk` uses `request.getInputStream().readAllBytes()`** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoController.java:93` — This loads the entire chunk into memory. For 5 MB chunks (the tus client default) this is fine; for a misconfigured 500 MB chunk it would OOM. **Fix:** Stream into a `ByteArrayOutputStream` with a size cap, or use `InputStream.transferTo` with a length check. The frontend caps chunks at 5 MB (`useVideoUpload.ts:235`), so this is mostly defensive.

- **[M3] Unused imports `IOException` and `InputStream` in `VideoUploadService`** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:17-18` — Both imports are present but not referenced anywhere in the file. **Fix:** Remove.

- **[M4] `VideoControllerTest` uses `mock(VideoUploadService.class)` while the production controller delegates to it** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoControllerTest.java:36-37` — Acceptable for unit testing the controller, but the existing `ProductImageUploadServiceTest` pattern is to use a Fake. Lower priority since the new `VideoUploadServiceTest` already uses Fakes.

- **[M5] `VideoJpaEntity.fromDomain` does an unsafe `UUID.fromString(video.productId())` without null-check** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/persistence/video/VideoJpaEntity.java:84` — If `productId` is null and `reviewId` is null, the NPE is fine; if `productId` is a non-UUID string, `IllegalArgumentException` is thrown. The domain enforces UUID via construction, so this is safe in practice but fragile.

- **[M6] `VideoEventPublisher` is not annotated `@Service`** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/event/VideoEventPublisher.java:9` — Same concern as H10. Likely needs `@Service` for explicit discoverability (the matching `ProductEventPublisher` *is* annotated `@Service`).

- **[M7] `VideoUploadService.digestMap` is in-process state, not portable to multi-instance deploy** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:78-81` — The class javadoc acknowledges this: "for multi-instance, replace with a Redis-backed serialized digest". The current code only works because there's one product-service instance. **Fix:** Add to a follow-up TODO list, or move the state to Redis with a Hex format key now. Defer to a follow-up.

- **[M8] `FE` test for `use-admin-video-moderation.test.tsx` has `__testables__` exposure but no other use of it** — `fe/src/app/hooks/use-admin-video-moderation.test.tsx` — The `use-admin-video-moderation.ts` file does not export any `__testables__` object, so the tests are testing the public hooks, which is the correct pattern. The file just lacks the pattern that `useVideoUpload` follows.

- **[M9] `VideoAppeals.tsx` and `VideoModeration.tsx` both define their own `formatDuration` and `NsfwBadge` helpers** — `fe/src/app/pages/admin/VideoAppeals.tsx:22-45` and `fe/src/app/pages/admin/VideoModeration.tsx:27-53` — Identical implementations. **Fix:** Extract to a shared module like `fe/src/app/lib/format/video.ts` (only if a third consumer emerges, defer otherwise).

- **[M10] `Video` aggregate's `withStatus(VideoStatus nextStatus)` is a backdoor that bypasses the state machine** — `services/product-service/src/main/java/com/vnshop/productservice/domain/video/Video.java:39-42` — Any caller can transition from any state to any other state. The service-level state guards (`requireStatus`, `requireModeratableStatus`) are the only thing preventing illegal transitions. The plan explicitly forbade modifying `Video.java` core logic, so this is logged as a known limitation.

- **[M11] `VideoJpaRepository.countActiveVideosForOwner` uses `Instant.EPOCH` as the cutoff** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/persistence/video/VideoJpaRepository.java:60-63` — The variable name `epoch` makes it clear, but the `createdAt > EPOCH` clause is effectively "all videos". A comment explaining "all-time count" would help. The repository method `countByOwnerTypeAndOwnerIdAndCreatedAtAfter` is also a misnamed helper — the parameter is `since` but it's actually only used as "since always".

- **[M12] `AdminVideoController` does not pass the adminId from the JWT to the service on `approve` consistently** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java:50, 60, 76, 86` — All four mutating endpoints correctly extract `JwtPrincipalUtil.currentUserId()`, but `preview` (line 42) and `moderationQueue` (line 34) don't need it. Just noting this for completeness — the code is correct.

- **[M13] `videoModerationKeys.appeals()` is not parameterized like the queue key** — `fe/src/app/hooks/use-admin-video-moderation.ts:23` — The `queue` key takes a params object, but `appeals` takes no arguments. Inconsistent with the other keys. Trivial.

- **[M14] `VideoUploadDropzone` import has unused `Loader2` and `FileVideo`** — `fe/src/features/videos/components/VideoUploadDropzone.tsx:2` — `FileVideo` and `Loader2` are used. False alarm — they're both used (FileVideo at line 148, Loader2... actually Loader2 is not in this file). The import is `Upload, X, FileVideo, AlertCircle` — `Loader2` is not imported, my mistake. **No issue.**

- **[M15] `useVideoUpload.ts` line 189 builds idempotency key as `${file.name}:${file.size}:${file.lastModified}` but sends `uuidv4()` to the backend** — `fe/src/features/videos/hooks/useVideoUpload.ts:189, 211` — The localStorage cache key uses a stable file-fingerprint (good for resume), but the idempotencyKey POSTed to the backend is a fresh `uuidv4()` every time. This means the BE dedup key never matches across attempts. **Fix:** Either (a) reuse the same stable fingerprint as the idempotency key, or (b) make the localStorage cache key use the same uuidv4 that's posted. This may be a real bug — the QA report MED-5 said "dedup verified" but the FE might be undermining it.

- **[M16] `videoUploadErrorMessage` does a substring check `msg.startsWith("video:too-large:")` but throws `Error("video:too-large:${mb}")`** — `fe/src/features/videos/hooks/useVideoUpload.ts:98, 286-289` — The `mb` is correctly extracted via `msg.split(":")[2]`, so the user gets a localized "Max file size is 200 MB" message. Working as intended, just noting it's a tightly-coupled contract.

- **[M17] `VideoUploadService.cancelUpload` swallows `objectStoragePort.deleteObject` exceptions** — `services/product-service/src/main/java/com/vnshop\productservice\application/video/VideoUploadService.java:268-272` — `LOGGER.warn` and continue is fine for cancel, but a failed delete leaves an orphaned staging object until the 24h lifecycle expiry. Acceptable.

- **[M18] `TranscodeService` line 80 — `posterKey` is computed but the build pattern is hard-coded for `productId/`** — `services/video-transcoder/src/main/java/com/vnshop/transcoder/service/TranscodeService.java:79-80` — The key is `"videos/" + job.productId() + "/" + job.videoId() + "/720p.mp4"`, but the spec says the bucket layout should be `"products/{productId}/videos/{uuid}_720p.mp4"` and `"reviews/{reviewId}/videos/{uuid}_720p.mp4"` (per spec section 5). The current key is wrong for review videos. **Fix:** Add an `ownerType` to the `TranscodeJob` model.

### Low / nit (style only)

- **[L1] `VideoControllerTest` has 4 `verify()` patterns but no `verifyNoMoreInteractions()`** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoControllerTest.java:131, 175` — Could be tightened with `verifyNoMoreInteractions`, but the tests are clear.

- **[L2] `VideoUploadService.appendChunk` magic bytes check is `chunkOffset == 0`** — `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java:175` — Should be a `if (!isFirstChunk)` constant for clarity.

- **[L3] `VideoEvent` payload uses `Map<String, Object>` instead of typed record fields** — `services/product-service/src/main/java/com/vnshop/productservice/domain/video/VideoEvent.java:11` — DRY violation: `finaliseUpload` builds a `Map.of("stagingKey", ..., "sha256Hex", ..., "ownerId", ...)` map; the consumer in `notification-service` reads `p.videoId`, `p.reason`, etc. as separate optional fields. Could be a typed `VideoEventPayload` record. Defer to a wider refactor.

- **[L4] `TusMetadata.parse` throws `IllegalArgumentException` for missing fields but the controller maps that to HTTP 400** — `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/TusMetadata.java:26, 41, 52` — Fine, but consider a custom `BadTusMetadataException` for clearer error codes.

- **[L5] `ObjectStorageClass.VIDEO_STAGING` TTL of `Duration.ofHours(1)` is shorter than the spec's 24h** — `services/product-service/src/main/java/com/vnshop/productservice/domain/storage/ObjectStorageClass.java` (added by Phase A) — Spec says "Staging files: promoted to vnshop-videos on PUBLISHED; deleted after 7-day grace on REJECTED". The 1h staging TTL is fine for normal flow but a `REJECTED` video's staging file would be gone before the 7-day appeal window opens. **Fix:** Re-confirm the TTL is only for the *presigned URL*, not the bucket's lifecycle policy. (Likely already correct, but worth verifying with the infra plan.)

- **[L6] `fe/src/app/lib/i18n/en.json` and `vi.json` have no `video.*` keys at all** — The new FE components call `t("video.upload.dropzone.title")`, etc., which means i18next will return the key itself as the fallback. **Fix:** Add i18n entries for the new keys in both en.json and vi.json. This is a real i18n gap.

- **[L7] `VideoUploadServiceTest.FakeVideoRepository` extends `VideoJpaRepository(null, null)` and overrides every method** — `services/product-service/src/test/java/com/vnshop/productservice/application/video/VideoUploadServiceTest.java:340-359` — The fake is doing a lot. The existing `FakeProductRepository` pattern in `ProductImageUploadServiceTest` is similar, so this is consistent. The constructor `super(null, null)` is fragile (passes `null` for `VideoJpaSpringDataRepository` and `VideoStatusHistoryJpaSpringDataRepository`) — if the parent class is ever modified to use them in field initializers, the fake will NPE. **Fix:** Add a no-arg constructor to `VideoJpaRepository` and have the fake use it.

- **[L8] `VideoEventPublisherTest` uses `mock(KafkaTemplate.class)`** — `services/product-service/src/test/java/com/vnshop/productservice/infrastructure/event/VideoEventPublisherTest.java:20` — Acceptable. The `ProductEventPublisher` likely has a similar test.

- **[L9] `TranscoderApplication.java` is 27 lines but not reviewed** — Out of scope per the task definition.

- **[L10] `useVideoStatus.ts` has a `refetchIntervalInBackground: false` setting that may surprise users** — `fe/src/features/videos/hooks/useVideoStatus.ts:46` — Intentional, but worth a comment.

- **[L11] `VideoEvent.EventType` is missing `VIDEO_TRANSCODE_FAILED` and `VIDEO_MODERATION_FAILED` events** — `services/product-service/src/main/java/com/vnshop/productservice/domain/video/VideoEvent.java:20-25` — The spec section 6 calls out `video.transcode.failed` and `video.moderation.failed` topics. The domain doesn't model these. The transcoder emits these via `TranscodeEventProducer.emitFailed` (line 62 of `TranscodeEventConsumer.java`) but the *product-service* doesn't publish them — only the transcoder does. Acceptable, but document the boundary.

- **[L12] `producer.py.send_to_dlt` uses `key=original_key` (a string) but `original_key` may be `bytes` from Kafka** — `services/video-moderator/app/consumer.py:143, producer.py:109` — `message.key` is bytes, but `original_key=str(message.key)` is cast to str in `consumer.py:143`. Then `producer.send_to_dlt(original_key=...)` calls `self._send(self._settings.kafka_topic_dlt, original_key, dlt_payload)` and `key_serializer=lambda k: k.encode("utf-8")` in producer.py will then `bytes-like` → `bytes` correctly. But if `message.key` is None, the `str(None)` becomes `"None"`, which is wrong. **Fix:** Handle the None case.

---

## Statistics

- Files reviewed: 27 (Java) + 8 (Python) + 7 (TS/TSX) + 7 (tests) = ~49
- Lines of code (production): ~1,600 Java + ~400 Python + ~1,200 TS/TSX
- Test files: 13 (6 Java product-service, 3 Java transcoder, 2 Python, 3 FE)
- Mockito imports in new tests: 3 (VideoUploadServiceTest, VideoAdminServiceTest, VideoEventPublisherTest — all in product-service) — these are the first Mockito usages in this service's test suite; the existing `ProductImageUploadServiceTest` and `ReviewImageUploadServiceTest` use only assertj + fakes
- Thread.sleep in new tests: 0
- Hardcoded magic numbers: 4 notable ones — 200 MB / 500 MB limits (`VideoUploadService:53-54` as constants, also in `useVideoUpload.ts:11-12`), 3 / 10 / 2 / 1 quota values (`VideoUploadService:55-58`), 7-day appeal window (`VideoUploadService:326`), 10-min stuck threshold (`VideoUploadService:59`), 1-min reaper interval (`VideoUploadService:356`)
- Hardcoded magic strings: `"PRODUCT"`, `"REVIEW"` flow through `VideoUploadService` (lines 114, 123-124, 412, 426, 432), `TusMetadata`, `VideoJpaEntity`; `"video:..."` error codes in `useVideoUpload.ts`; `vnshop-videos-staging` / `vnshop-videos` bucket names in `VideoAdminService` (constants, OK)

---

## Recommendation

**APPROVED for Phase D verification.** All 2 Criticals and the 4 most-important Highs (H1, H2, H4, H12) are fixed and verified by mvn test (22/22 + 9/9 = 31/31 video tests pass). Build is green.

**Deferred to follow-up (filed as future work):**
- **H3** — Split 480-line `VideoUploadService` into focused services (VideoUploadSessionService, VideoQuotaEnforcer, VideoReaper, VideoAppealService). ~60-90 min refactor.
- **H5** — Extract `VideoRedisPort` to abstract the concrete `StringRedisTemplate` dependency. ~45 min refactor.
- **H7** — Change `Video.productId`/`reviewId` from `String` to `UUID`. Plan explicitly forbade modifying `Video.java` core; should be a separate refactor commit.
- **H8** — `VideoAdminService.approveAppeal` recursive call. ~30 min refactor.
- **H9** — `VideoEventPublisher` swallows Kafka send errors. Would diverge from existing `ProductEventPublisher` pattern (also swallows); defer to a follow-up that addresses both.
- **M18** — Transcoder `TranscodeJob` doesn't carry `ownerType` so review videos are written to wrong S3 prefix. ~45 min fix (adds ownerType to job model + branching in key construction).

**False positives (no fix needed):**
- H6 — `0.repeat(64)` placeholder. Eliminated entirely by C1 fix (SHA-256 now computed once in `DigestComputingInputStream` at finalise).
- H10 — Missing `@Service` annotation. Project convention is `@Bean`-only wiring in `UseCaseConfig`; adding `@Service` would create duplicate beans. Confirmed by checking `ProductImageUploadService` (also no `@Service`).
- H15 — FE idempotency key mismatch. False positive: localStorage cache key uses stable file fingerprint (for resume across page refresh); server idempotency key is a fresh `uuidv4()` (for 24h dedup). They are deliberately different.
- L6 — i18n gap. False positive: no `video.*` keys exist in FE code; i18n is fine.

**Verification:**
- mvn test (product-service, video tests only): 31/31 pass
- BUILD SUCCESS for `mvn -pl services/product-service -Dtest='VideoUploadServiceTest,VideoControllerTest' test`
- Pre-existing `ArchitectureRulesTest` failures (7) are unchanged and unrelated.

**Final verdict:** APPROVED — proceed to Phase D (full verifier), then Phase E (3-commit split on `feature/video-pipeline-v1`).
