import { z } from "zod";

import { addressSchema } from "@/shared/contracts/api/shared";

// BE returns BuyerProfileResponse(keycloakId, email, name, phone, avatarUrl, addresses).
// Email is persisted by user-service at registration time. The compatibility
// transform below still accepts older payloads that omit the field.
export const userProfileSchema = z
  .object({
    id: z.string().optional(),
    keycloakId: z.string().optional(),
    email: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    addresses: z.array(addressSchema).optional(),
    role: z.string().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.keycloakId ?? "",
    email: raw.email ?? "",
    name: raw.name ?? undefined,
    phone: raw.phone ?? undefined,
    avatar: raw.avatar ?? raw.avatarUrl ?? undefined,
    addresses: raw.addresses,
    role: raw.role,
  }));
export type UserProfile = z.infer<typeof userProfileSchema>;

/** BE response for `POST /users/me/avatar/upload` — the presigned PUT URL
 *  the browser uploads against, plus the canonical objectKey to echo back
 *  to /activate. */
export const avatarUploadResponseSchema = z
  .object({
    objectKey: z.string(),
    uploadUrl: z.string(),
    expiresInSeconds: z.number(),
  })
  .passthrough();
export type AvatarUploadInit = z.infer<typeof avatarUploadResponseSchema>;
