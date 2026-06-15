# Video Upload Pipeline — QA Verification Report

**Date:** 2026-06-15  
**Reviewer:** Worker-11 (BA + QA + Customer Journey Analyst)  
**Spec Reference:** `docs/superpowers/specs/2026-06-15-video-upload-pipeline-design.md` (Revised)

---

## 1. Executive Summary

The video upload pipeline implementation is **substantially complete** with solid architecture following DDD/hexagonal patterns. All major spec requirements are addressed. However, **3 critical defects** and **8 medium-severity findings** were identified during code review that must be resolved before production deployment.

**Overall Assessment:** PASS with conditions (critical items must be fixed)

---

## 2. BA Verification — Spec vs Implementation

### 2.1 Endpoints (All Present)

| Spec Endpoint | Implementation | Status |
|---|---|---|
| `POST /api/v1/videos/upload` | `VideoController.createUpload()` | PASS |
| `PATCH /api/v1/videos/upload/{id}` | `VideoController.uploadChunk()` | PASS |
| `HEAD /api/v1/videos/upload/{id}` | `VideoController.getOffset()` | PASS |
| `DELETE /api/v1/videos/upload/{id}` | `VideoController.cancelUpload()` | PASS |
| `DELETE /api/v1/videos/{videoId}` | `VideoController.deleteVideo()` | PASS |
| `POST /api/v1/videos/{videoId}/appeal` | `VideoController.submitAppeal()` | PASS |
| `GET /admin/videos/moderation-queue` | `AdminVideoController.moderationQueue()` | PASS |
| `GET /admin/videos/{videoId}/preview` | `AdminVideoController.preview()` | PASS |
| `POST /admin/videos/{videoId}/approve` | `AdminVideoController.approve()` | PASS |
| `POST /admin/videos/{videoId}/reject` | `AdminVideoController.reject()` | PASS |
| `GET /admin/videos/appeal-queue` | `AdminVideoController.appeals()` | PASS |
| `POST /admin/videos/{videoId}/appeal/approve` | `AdminVideoController.approveAppeal()` | PASS |
| `POST /admin/videos/{videoId}/appeal/reject` | `AdminVideoController.rejectAppeal()` | PASS |

### 2.2 State Machine Transitions

| Transition | Guard | Implementation | Status |
|---|---|---|---|
| UPLOADING → UPLOADED | Upload-Offset == Upload-Length | `VideoController` final chunk detection | PASS |
| UPLOADED → TRANSCODING | idempotency (only from UPLOADED) | `TranscodeEventConsumer` consumes `video.upload.completed` | PASS |
| TRANSCODING → TRANSCODED | transcoded file verified | `TranscodeService` verifies upload to staging | PASS |
| TRANSCODED → MODERATING | moderation requested | `ModerationConsumer` consumes `video.transcode.completed` | PASS |
| MODERATING → AUTO_APPROVED | score < 0.3 | `ModerationConsumer._classify()` | PASS |
| MODERATING → PENDING_REVIEW | 0.3 ≤ score ≤ 0.7 | `ModerationConsumer._classify()` | PASS |
| MODERATING → AUTO_REJECTED | score > 0.7 | `ModerationConsumer._classify()` | PASS |
| PENDING_REVIEW → APPROVED/REJECTED | ROLE_ADMIN | `@PreAuthorize("hasRole('ADMIN')")` | PASS |
| REJECTED → APPEAL_PENDING | owner within 7 days | `VideoUploadService.submitAppeal()` | PASS (MED-3 resolved) |
| APPEAL_PENDING → PUBLISHED/REJECTED | ROLE_ADMIN | `VideoAdminService.approveAppeal()/rejectAppeal()` | PASS |
| → PUBLISHED | transcoded_object_key non-null | `Video.withApproval()` sets publicKey | PASS |
| → DELETED | owner or ADMIN, from PUBLISHED | `VideoUploadService.deleteVideo()` | PASS |

### 2.3 Business Rules

| Rule | Spec | Implementation | Status |
|---|---|---|---|
| Max 3 videos per product | HTTP 422 | `VideoUploadService.enforceQuotas()` | PASS |
| Max 1 video per review | HTTP 422 | `VideoUploadService.enforceQuotas()` | PASS |
| Max 10 videos/day per user | Rate limit | `VideoUploadService.enforceQuotas()` | PASS |
| Max 2 concurrent uploads | Redis counter | `VideoUploadService.enforceConcurrentSessionLimit()` | PASS |
| POST rate limit: 1 req/s burst 3 | Redis | `VideoUploadService.enforceRateLimit()` | PASS |
| PATCH not rate-limited | By design | Only POST goes through rate limiter | PASS |
| File size max 500 MB | Reject at creation | `VideoUploadService.enforceFileSizeLimit()` | PASS |
| First-chunk magic bytes | ftyp/EBML/RIFF | `VideoUploadService.validateMagicBytes()` | PASS |
| SHA-256 incremental | Running hash per PATCH | **NOT IMPLEMENTED** — only final chunk hashed | **FAIL** |
| Idempotency key on POST | UUID v4, 24h dedup | TusMetadata parsed from header | PARTIAL (no dedup logic visible) |

---

## 3. Critical Defects

### CRITICAL-1: SHA-256 Not Computed Incrementally

**File:** `VideoController.java:101`  
**Spec requirement:** "SHA-256 is computed incrementally during chunked upload (running hash updated per PATCH). The final digest is stored in sha256_hex once Upload-Offset == Upload-Length."  
**Actual:** `VideoUploadService.sha256Hex(chunkData)` hashes only the last chunk's bytes, not the accumulated file.  
**Impact:** TOCTOU prevention is broken. The transcoder will verify a hash that doesn't represent the full file content.  
**Fix:** Maintain a `MessageDigest` state in Redis (serialized) or compute hash on the assembled file after final chunk.

### CRITICAL-2: Stuck-Video Reaper Transitions to DELETED Instead of FAILED

**File:** `VideoUploadService.java:309`  
**Spec requirement:** "Transitions them to FAILED with reason = 'stuck_timeout'"  
**Actual:** `stuck.withStatus(VideoStatus.DELETED)` — transitions to DELETED.  
**Impact:** (1) VideoStatus enum doesn't even have a FAILED state. (2) DELETED implies intentional removal; FAILED implies pipeline error. Downstream consumers and the frontend use FAILED as a terminal error state. (3) No `video.transcode.failed` event emitted as spec requires.  
**Fix:** Add `FAILED` to `VideoStatus` enum. Reaper should transition to FAILED and emit appropriate failure events.

### CRITICAL-3: TranscodeService Loads Entire File Into Memory for SHA-256

**File:** `TranscodeService.java:133`  
**Code:** `byte[] bytes = Files.readAllBytes(file);`  
**Impact:** For a 500 MB video file, this allocates 500 MB on the heap. With a 2 GB container memory limit and FFmpeg also running, this will cause OutOfMemoryError on large files.  
**Fix:** Use streaming `DigestInputStream` or read in 8 KB buffer chunks.

---

## 4. Medium-Severity Findings

### MED-1: Kafka Topic Mismatch (Spec vs Implementation)

**Status: RESOLVED** (2026-06-15)

**Spec Section 6:** Consumer groups table said `moderator-worker → video.moderation.requested`  
**Implementation:** Moderator consumes `video.transcode.completed` directly (config.py line 12)  
**Kafka ACLs:** Grant moderator read on `video.transcode.completed`  
**Resolution:** Spec Section 6 updated to remove `video.moderation.requested` and `video.moderation.requested.DLT` from topic list; consumer groups table now shows `moderator-worker → video.transcode.completed`; note added explaining the implementation bypasses the relay topic. `video.moderation.completed` DLT removed from spec.  
**Section 1 also updated:** 200 MB review / 500 MB product file-size limits documented in spec with note referencing `VideoUploadService.enforceFileSizeLimit()`.

### MED-2: Reaper Interval Deviation

**Status:** ✅ RESOLVED (2026-06-15)

**Spec:** `@Scheduled(fixedDelay = 60_000)` (every 1 minute)  
**Original Implementation:** `@Scheduled(fixedDelay = 5 * 60 * 1000)` (every 5 minutes)  
**Current Implementation:** `@Scheduled(fixedDelay = 60_000)` ✅
**Resolution:** `VideoUploadService.reaperSweep()` annotation updated; mvn test 21/21 passes.

### MED-3: No 7-Day Appeal Window Enforcement

**Status:** ✅ RESOLVED (2026-06-15)

**Spec:** "REJECTED → APPEAL_PENDING: uploader submits appeal within 7-day grace period"  
**Resolution:** `VideoUploadService.submitAppeal()` now throws `VideoValidationException("appeal_window_expired", ...)` when `Duration.between(moderatedAt, now).toDays() > 7`. `VideoValidationException` extended with 2-arg `(code, message)` constructor.  
**Test coverage:** `submitAppeal_rejectsAfter7DayWindow` (8-day-old rejection throws) + `submitAppeal_allowsWithin7DayWindow` (3-day-old rejection succeeds). mvn test 21/21.

### MED-4: Frontend VideoStatus Missing States

**File:** `fe/src/app/types/api/video.ts`  
**States present:** PENDING, UPLOADING, TRANSCODING, MODERATING, PUBLISHED, REJECTED, FAILED  
**States missing:** UPLOADED, TRANSCODED, AUTO_APPROVED, PENDING_REVIEW, AUTO_REJECTED, APPEAL_PENDING, APPROVED, DELETED  
**Impact:** Frontend polling won't display correct status for intermediate states. The admin queue uses PENDING_REVIEW which isn't in the schema.  
**Mitigation:** This may be intentional — backend could map internal states to simplified FE states.

### MED-5: Idempotency Key Deduplication Not Implemented

**Status:** ✅ RESOLVED (2026-06-15)

**Resolution:** `VideoUploadService.createUploadSession()` now checks Redis for `video:idempotency:{key}` before creating a new record. If present, returns the existing `Video` (same `videoId`). After a successful new create, sets the Redis key with 24h TTL.  
**Tradeoff:** Redis is the source of truth for dedup; no DB column added. If Redis is wiped, dedup breaks for 24h — acceptable for self-hosted single-instance.  
**Test coverage:** `createUploadSession_duplicateIdempotencyKey_returnsExistingVideo` verifies the same `videoId` is returned and no second row is saved. mvn test 21/21.

### MED-6: Moderator DB Config Incompatible

**File:** `video-moderator/app/config.py:41`  
**Config:** `database_url = "postgresql+asyncpg://vnshop:vnshop@postgres-legacy:5432/vnshop"`  
**File:** `video-moderator/app/db.py:3`  
**Import:** `import psycopg2` (synchronous driver)  
**Impact:** The `+asyncpg` URL scheme will fail with psycopg2. Need either `postgresql://...` or switch to asyncpg.

### MED-7: Moderator Retry Count Off-By-One

**Status:** ✅ RESOLVED (2026-06-15)

**Spec section 10:** "3 attempts, exponential backoff"  
**Original Implementation:** `retry_delays = [10, 30, 120]` + `range(len(delays) + 1)` = 4 total attempts.  
**Current Implementation:** `retry_delays = [30, 120]` + `max_attempts = len(delays) + 1 = 3` attempts total.  
**Resolution:** Changed config default to `[30, 120]` and refactored the loop in `consumer.py` to use `max_attempts` semantics. The semantics are now: initial attempt + N-1 retries.

### MED-8: Admin Queue URL Path Deviation

**Status:** ✅ RESOLVED (2026-06-15)

**Spec:** `GET /admin/videos/appeal-queue`  
**Original Implementation:** `GET /admin/videos/appeals` (both backend and frontend)  
**Resolution:** `AdminVideoController.appeals()` `@GetMapping` changed to `/appeal-queue` (backend done by worker-a1). FE updated: `adminVideoAppealsQueue()` endpoint added to `admin.ts` with correct `/appeal-queue` path; `useVideoAppeals()` hook updated to call `adminVideoAppealsQueue`; test mocks updated. Video admin type schemas (`adminVideoModerationQueuePageSchema`, `adminVideoAppealItemSchema`, `adminVideoModerationResponseSchema`) added to `types/api/admin.ts`.

### MED-9: No Server-Side 200 MB Limit for Review Videos (NEW from spec review)

**Status:** ✅ RESOLVED (2026-06-15)

**Spec:** "Review videos: max 5 min, 200 MB. Product videos: max 10 min, 500 MB."  
**Original Implementation:** `enforceFileSizeLimit()` used a single `MAX_VIDEO_BYTES = 500 MB` for both owner types. Frontend enforced 200 MB for reviews, but backend allowed up to 500 MB.  
**Resolution:** Split into `MAX_PRODUCT_VIDEO_BYTES = 500 MB` and `MAX_REVIEW_VIDEO_BYTES = 200 MB`. `enforceFileSizeLimit(contentLength, ownerType)` now branches on owner type.  
**Test coverage:** `createUploadSession_rejectsReviewVideoOver200Mb` + `createUploadSession_acceptsProductVideoAt500MbBoundary`. mvn test 21/21.

---

## 5. Customer Journey Verification

### Journey 1: Seller Uploads Product Video (Happy Path)

| Step | Code Path | Verified |
|---|---|---|
| 1. Seller selects video file | `VideoUploadDropzone.handleFiles()` | PASS |
| 2. Client-side validation (type, size) | `useVideoUpload.preflightVideo()` | PASS |
| 3. Duration estimation | `useVideoUpload.estimateDuration()` via `<video>` element | PASS |
| 4. POST /videos/upload-init | `videoUploadInit()` → `VideoController.createUpload()` | PASS |
| 5. Rate limit + quota check | `VideoUploadService.createUploadSession()` | PASS |
| 6. tus chunked upload (5MB chunks) | `tus-js-client` → PATCH handler | PASS |
| 7. Magic bytes validated on first chunk | `VideoUploadService.validateMagicBytes()` | PASS |
| 8. Upload completes → `video.upload.completed` | `VideoUploadService.finaliseUpload()` | PASS |
| 9. Toast: "Video uploaded, processing..." | `useVideoUpload` onSuccess callback | PASS |
| 10. Transcoder downloads + verifies SHA-256 | `TranscodeService.verifySha256()` | PASS* |
| 11. FFmpeg 720p transcode | `FfmpegCommandBuilder.buildTranscodeCommand()` | PASS |
| 12. Poster frame extracted | `FfmpegCommandBuilder.buildPosterCommand()` at 10% | PASS |
| 13. Upload to staging bucket | `TranscodeService.uploadToStaging()` | PASS |
| 14. Raw file deleted | `TranscodeService.deleteRaw()` | PASS |
| 15. Moderation: frame extraction + NudeNet | `Moderator.analyze_video()` | PASS |
| 16. Score < 0.3 → AUTO_APPROVED | `ModerationConsumer._classify()` | PASS |
| 17. Staging → public bucket | `StorageClient.promote_to_public()` | PASS |
| 18. `video.moderation.completed` emitted | `ModerationProducer.send_moderation_completed()` | PASS |
| 19. Status polling shows PUBLISHED | `useVideoStatus` + adaptive polling | PASS |

*Note: SHA-256 verification relies on hash computed in step 8 which is only the last chunk (CRITICAL-1).

### Journey 2: Buyer Uploads Review Video

| Step | Delta from Journey 1 | Status |
|---|---|---|
| Max file size | 200 MB (FE enforced, not BE differentiated) | PARTIAL |
| Quota | 1 per review enforced | PASS |
| Owner type | "REVIEW" passed through metadata | PASS |

**Finding:** Frontend enforces 200MB for reviews vs 500MB for products. Backend `enforceFileSizeLimit()` uses a single 500MB limit regardless of owner type. This means the backend doesn't enforce the 200MB review limit — only the client does. Server-side enforcement missing.

### Journey 3: Moderation Rejection + Appeal Flow

| Step | Code Path | Status |
|---|---|---|
| Score > 0.7 → AUTO_REJECTED | `ModerationConsumer._classify()` | PASS |
| `video.rejected` emitted | `ModerationProducer.send_video_rejected()` | PASS |
| Status shows REJECTED + reason | Frontend displays rejectionReason | PASS |
| User submits appeal | `POST /api/v1/videos/{id}/appeal` | PASS |
| Appeal reason required (non-blank) | `VideoUploadService.submitAppeal()` validation | PASS |
| Status → APPEAL_PENDING | `Video.withAppeal()` | PASS |
| Admin sees appeal queue | `GET /admin/videos/appeals` | PASS |
| Admin preview with original rejection + appeal text | `VideoAppeals.tsx` shows both | PASS |
| Admin approves → PUBLISHED | `VideoAdminService.approveAppeal()` | PASS |
| Admin rejects → final REJECTED | `VideoAdminService.rejectAppeal()` | PASS |
| 7-day grace window | **NOT ENFORCED** | FAIL (MED-3) |

### Journey 4: Resume Interrupted Upload

| Step | Code Path | Status |
|---|---|---|
| Upload URL stored in localStorage | `setResumeEntry()` with key `vnshop:video-upload-resume:{idempotencyKey}` | PASS |
| Page refresh → cached entry found | `getResumeEntry()` checks name+size+lastModified | PASS |
| tus `findPreviousUploads()` called | `tusUpload.findPreviousUploads()` + `resumeFromPreviousUpload()` | PASS |
| HEAD request returns correct offset | `VideoController.getOffset()` reads from Redis | PASS |
| Upload continues from last offset | tus library handles this natively | PASS |
| On complete, localStorage cleared | `clearResumeEntry()` in onSuccess | PASS |

### Journey 5: Rate Limiting (10/day, Concurrent Limits)

| Step | Code Path | Status |
|---|---|---|
| POST burst limit (3/s) | Redis increment + TTL 1s, reject if > 3 | PASS |
| Daily limit (10 creations/day) | `videoJpaRepository.countUploaderVideosToday()` | PASS |
| Concurrent limit (2 sessions) | Redis `CONCURRENT_KEY_PREFIX` check | PASS |
| Decrement on complete/cancel | `decrementConcurrentSessions()` called | PASS |
| Decrement on stuck reaper | `decrementConcurrentSessions(stuck.ownerId())` | PASS |

### Journey 6: Concurrent Upload Limit (2 max)

| Step | Code Path | Status |
|---|---|---|
| Third upload attempt | `enforceConcurrentSessionLimit()` throws | PASS |
| Exception type | `VideoUploadRateLimitException` | PASS |
| Session released on cancel | `cancelUpload()` → `decrementConcurrentSessions()` | PASS |
| Session released on complete | `finaliseUpload()` → `decrementConcurrentSessions()` | PASS |
| TTL safety net (1h) | `redisTemplate.expire(concurrentKey, Duration.ofHours(1))` | PASS |

---

## 6. Test Coverage Assessment

### 6.1 Video Transcoder Tests

| Test File | Coverage Area | Status |
|---|---|---|
| `FfmpegCommandBuilderTest.java` | Command construction, safety flags | PASS |
| `Sha256VerificationTest.java` | Hash verification logic | PASS |
| `TranscodeServiceTest.java` | Full pipeline workflow | PASS |

### 6.2 Video Moderator Tests

| Test File | Coverage Area | Status |
|---|---|---|
| `test_moderator.py` | NudeNet inference, frame extraction | PASS |
| `test_consumer.py` | Kafka consumer workflow, retry logic | PASS |

### 6.3 Product Service Video Tests

| Test File | Coverage Area | Status |
|---|---|---|
| `VideoTest.java` | Domain object state transitions | PASS |
| `VideoEventTest.java` | Event construction | PASS |
| `VideoEventPublisherTest.java` | Kafka publishing | PASS |
| `VideoAdminServiceTest.java` | Admin moderation flows | PASS |

### 6.4 Missing Test Coverage

| Area | Missing Tests | Priority |
|---|---|---|
| VideoUploadService | No unit tests for upload/quota/rate-limit | HIGH |
| VideoController (tus endpoints) | No integration tests for tus protocol | HIGH |
| Frontend hooks | No tests for `useVideoUpload`, `useVideoStatus` | MEDIUM |
| Notification-service | No video event consumer tests | HIGH |
| End-to-end Kafka flow | No integration test for full pipeline | HIGH |
| Edge cases | Zero-byte file, corrupt header, long filename, unicode metadata | MEDIUM |

---

## 7. Error Handling Assessment

| Scenario | Handling | Status |
|---|---|---|
| FFmpeg failure (non-zero exit) | `TranscodeException` → retry → DLT | PASS |
| FFmpeg timeout (>300s) | `timeout --signal=KILL 300` + Java 360s safety | PASS |
| MinIO download failure | Exception propagates → retry | PASS |
| MinIO upload failure | Exception propagates → retry | PASS |
| Kafka unreachable (producer) | `KafkaError` raised, retry | PASS |
| Kafka unreachable (consumer) | Consumer poll timeout, reconnect | PASS |
| NudeNet model failure | Per-frame: returns 0.0 with warning log | PASS |
| Invalid video format | Magic byte validation rejects at first chunk | PASS |
| File too large | Rejected at POST creation time | PASS |
| Quota exceeded | HTTP 422 with specific exception | PASS |
| Concurrent limit | HTTP 429 with specific exception | PASS |
| Zero-byte file | Client-side: `file.size <= 0` check. Server: no explicit check | PARTIAL |
| Corrupt video header | ffprobe failure in transcoder → TranscodeException | PASS |
| Long filename | No length validation on filename field | MINOR |
| Unicode metadata | JSON serialization handles it, no explicit sanitization | PASS |

---

## 8. Security Checklist

| Requirement | Implementation | Status |
|---|---|---|
| FFmpeg read-only filesystem | `read_only: true` in docker-compose | PASS |
| Cap drop ALL | `cap_drop: ALL` in docker-compose | PASS |
| No-new-privileges | `no-new-privileges:true` in docker-compose | PASS |
| Protocol whitelist (file only) | `-protocol_whitelist file` in FFmpeg command | PASS |
| First-chunk validation | Magic bytes at offset 0 | PASS |
| TOCTOU prevention (SHA-256) | Transcoder verifies hash | PASS* |
| Metadata stripping | `-map_metadata -1` | PASS |
| Resource limits (CPU/mem) | Docker limits set for all workers | PASS |
| Video-specific rate limiting | Redis-based, POST only | PASS |
| Concurrent upload limit | Redis counter, max 2 | PASS |
| Admin-only moderation | `@PreAuthorize("hasRole('ADMIN')")` | PASS |
| Owner-only operations | `findAndAuthorise()` checks ownerId | PASS |

*Conditional on CRITICAL-1 being fixed (hash currently only covers last chunk).

---

## 9. Notification Messages (Vietnamese Copy)

| Event | Spec Copy | Implementation | Status |
|---|---|---|---|
| VIDEO_PUBLISHED | "Video da duoc duyet va dang hien thi" | Notification service handler NOT YET IMPLEMENTED | BLOCKED |
| VIDEO_REJECTED | "Video bi tu choi. Ly do: {reason}" | Notification service handler NOT YET IMPLEMENTED | BLOCKED |

**Note:** The notification-service has no video event consumers yet. Task #10 (integration testing + notification service) is still in progress.

---

## 10. Recommendations

### Must Fix Before Launch (Critical)
1. Implement incremental SHA-256 computation during upload
2. Add FAILED status to enum; fix reaper to use it with proper events
3. Use streaming digest in TranscodeService instead of `readAllBytes()`

### Should Fix Before Launch (Medium)
4. Add 7-day appeal window enforcement
5. Fix moderator DB URL (remove `+asyncpg` prefix for psycopg2)
6. Implement idempotency key deduplication
7. Add server-side 200MB limit for review videos
8. Add VideoUploadService unit tests

### Nice To Have (Low)
9. Align reaper interval with spec (1 min vs 5 min)
10. Add filename length validation
11. Align spec topic names with implementation

---

## 11. Appendix: Files Reviewed

### Backend (product-service)
- `services/product-service/src/main/resources/db/migration/V7__videos.sql`
- `services/product-service/src/main/java/com/vnshop/productservice/domain/video/Video.java`
- `services/product-service/src/main/java/com/vnshop/productservice/domain/video/VideoStatus.java`
- `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoUploadService.java`
- `services/product-service/src/main/java/com/vnshop/productservice/application/video/VideoAdminService.java`
- `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/VideoController.java`
- `services/product-service/src/main/java/com/vnshop/productservice/infrastructure/web/video/AdminVideoController.java`

### Video Transcoder
- `services/video-transcoder/src/main/java/com/vnshop/transcoder/service/FfmpegCommandBuilder.java`
- `services/video-transcoder/src/main/java/com/vnshop/transcoder/service/TranscodeService.java`
- `services/video-transcoder/src/main/java/com/vnshop/transcoder/consumer/TranscodeEventConsumer.java`

### Video Moderator
- `services/video-moderator/app/moderator.py`
- `services/video-moderator/app/consumer.py`
- `services/video-moderator/app/producer.py`
- `services/video-moderator/app/config.py`
- `services/video-moderator/app/storage.py`
- `services/video-moderator/app/db.py`

### Frontend
- `fe/src/features/videos/hooks/useVideoUpload.ts`
- `fe/src/features/videos/hooks/useVideoStatus.ts`
- `fe/src/features/videos/components/VideoUploadDropzone.tsx`
- `fe/src/features/videos/components/VideoUploadProgress.tsx`
- `fe/src/features/videos/components/VideoPlayer.tsx`
- `fe/src/app/hooks/use-admin-video-moderation.ts`
- `fe/src/app/pages/admin/VideoModeration.tsx`
- `fe/src/app/pages/admin/VideoAppeals.tsx`
- `fe/src/app/types/api/video.ts`
- `fe/src/app/lib/api/endpoints/videos.ts`

### Infrastructure
- `infra/scripts/init-kafka-topics.sh`
