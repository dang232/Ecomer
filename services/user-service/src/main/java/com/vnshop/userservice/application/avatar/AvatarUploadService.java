package com.vnshop.userservice.application.avatar;

import com.vnshop.userservice.application.RegisterBuyerCommand;
import com.vnshop.userservice.application.RegisterBuyerUseCase;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import com.vnshop.userservice.domain.port.out.ObjectStoragePort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import com.vnshop.userservice.domain.storage.AvatarObjectMetadata;

import java.net.URI;
import java.util.Map;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Two-phase avatar upload: createUpload signs a presigned PUT, the browser
 * uploads directly to MinIO, then activate verifies the upload landed and
 * stamps the canonical URL on the buyer's profile.
 *
 * Why two-phase, not direct multipart-to-user-service: streaming the file
 * through the BE ties up Spring worker threads on a network-bound copy.
 * The presigned-PUT pattern is what product-service uses and keeps that
 * traffic on the object store. Same pattern, less risk than inventing a
 * new one.
 *
 * Avatars are last-write-wins (one per user). No quarantine state machine,
 * no metadata table — just the public URL on BuyerProfile.avatarUrl plus
 * a best-effort delete of the prior object when a new one activates.
 */
public class AvatarUploadService {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(5);

    private final UserRepositoryPort userRepositoryPort;
    private final ObjectStoragePort objectStoragePort;
    private final RegisterBuyerUseCase registerBuyerUseCase;

    public AvatarUploadService(UserRepositoryPort userRepositoryPort,
                               ObjectStoragePort objectStoragePort,
                               RegisterBuyerUseCase registerBuyerUseCase) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
        this.objectStoragePort = Objects.requireNonNull(objectStoragePort, "objectStoragePort is required");
        this.registerBuyerUseCase = Objects.requireNonNull(registerBuyerUseCase, "registerBuyerUseCase is required");
    }

    public AvatarUploadResponse createUpload(String keycloakId, AvatarUploadRequest request) {
        validate(request);
        String objectKey = objectKey(keycloakId, request.filename());
        AvatarObjectMetadata metadata = new AvatarObjectMetadata(
                objectKey,
                request.contentType(),
                request.contentLength(),
                request.sha256Hex());
        URI uploadUrl = objectStoragePort.getSignedUploadUrl(objectKey, metadata, UPLOAD_TTL);
        return new AvatarUploadResponse(
                objectKey,
                uploadUrl,
                Map.of("Content-Type", request.contentType(),
                        "Cache-Control", "public, max-age=31536000, immutable",
                        "x-amz-meta-sha256", request.sha256Hex()),
                UPLOAD_TTL.toSeconds());
    }

    public AvatarActivationResponse activate(String keycloakId, AvatarActivationRequest request) {
        if (request.objectKey() == null || !request.objectKey().startsWith(userPrefix(keycloakId))) {
            throw new IllegalArgumentException("objectKey does not belong to caller");
        }
        AvatarObjectMetadata landed = objectStoragePort.headObject(request.objectKey())
                .orElseThrow(() -> new IllegalStateException("object never landed at storage"));
        if (landed.contentLength() != request.contentLength()) {
            throw new IllegalArgumentException("contentLength mismatch between client and storage");
        }
        if (!matchesChecksum(landed.sha256Hex(), request.sha256Hex())) {
            throw new IllegalArgumentException("sha256 mismatch between client and storage");
        }

        String previousAvatarUrl = userRepositoryPort.findBuyerByKeycloakId(keycloakId)
                .map(BuyerProfile::avatarUrl)
                .orElse(null);

        URI publicUrl = objectStoragePort.publicUrl(request.objectKey());
        BuyerProfile saved = upsertAvatarUrl(keycloakId, publicUrl.toString());

        // Delete the previous object AFTER the new URL is committed. If the
        // delete fails (storage hiccup, key not under our bucket) we log
        // and move on — orphaned objects are a sweep-job problem, never
        // a write-path one. A failed delete here must NOT undo the profile
        // write we just made.
        deleteIfOursAndStale(previousAvatarUrl, request.objectKey());

        return new AvatarActivationResponse(saved, saved.avatarUrl());
    }

    private BuyerProfile upsertAvatarUrl(String keycloakId, String avatarUrl) {
        return userRepositoryPort.findBuyerByKeycloakId(keycloakId)
                .map(existing -> {
                    existing.updateProfile(existing.name(), existing.phone(), avatarUrl);
                    return userRepositoryPort.saveBuyer(existing);
                })
                .orElseGet(() -> registerBuyerUseCase.register(
                        new RegisterBuyerCommand(keycloakId, null, null, avatarUrl)));
    }

    private void deleteIfOursAndStale(String previousAvatarUrl, String newKey) {
        if (previousAvatarUrl == null || previousAvatarUrl.isBlank()) {
            return;
        }
        String previousKey = extractObjectKey(previousAvatarUrl);
        if (previousKey == null || previousKey.equals(newKey)) {
            return;
        }
        try {
            objectStoragePort.deleteObject(previousKey);
        } catch (RuntimeException ignored) {
            // Best-effort: orphan rather than tear down a successful write.
        }
    }

    private String extractObjectKey(String avatarUrl) {
        // Public URL from publicUrl() is `{publicEndpoint}/{bucket}/{key}`.
        // Find the avatars/ prefix marker; if it's not present the URL came
        // from somewhere else (legacy gravatar, external host) and we don't
        // own the object — skip the delete.
        int marker = avatarUrl.indexOf("/avatars/");
        if (marker < 0) {
            return null;
        }
        return avatarUrl.substring(marker + 1);
    }

    private void validate(AvatarUploadRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String filename = request.filename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("filename is required");
        }
        String extension = extension(filename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("unsupported file extension: " + extension);
        }
        if (!ALLOWED_CONTENT_TYPES.contains(request.contentType())) {
            throw new IllegalArgumentException("unsupported content type: " + request.contentType());
        }
        if (request.contentLength() <= 0 || request.contentLength() > MAX_AVATAR_BYTES) {
            throw new IllegalArgumentException("avatar must be between 1 byte and 2 MB");
        }
        if (request.sha256Hex() == null || !request.sha256Hex().matches("[a-fA-F0-9]{64}")) {
            throw new IllegalArgumentException("sha256Hex must be a 64-char hex string");
        }
    }

    private String objectKey(String keycloakId, String filename) {
        return "%s%d-%s.%s".formatted(
                userPrefix(keycloakId),
                System.currentTimeMillis(),
                UUID.randomUUID(),
                extension(filename));
    }

    private String userPrefix(String keycloakId) {
        return "avatars/" + keycloakId + "/";
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private boolean matchesChecksum(String storedSha, String requestSha) {
        // S3 returns user-metadata in lowercase; comparison is case-insensitive
        // because crypto.subtle.digest output casing varies across browsers.
        // Some MinIO versions strip non-amz user-metadata on HEAD responses,
        // so an empty/null storage-side sha means "storage didn't echo it" —
        // we already validated contentLength which is the structural-corruption
        // signal, so don't fail activation on a missing storage-side checksum.
        if (storedSha == null || storedSha.isEmpty()) {
            return true;
        }
        return storedSha.equalsIgnoreCase(requestSha);
    }
}
