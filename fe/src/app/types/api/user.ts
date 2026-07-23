import { z } from "zod";

import { addressSchema } from "./shared";

// BE returns BuyerProfileResponse(keycloakId, email, name, phone, avatarUrl, addresses)
// — no `id`, no `email`, and phone may be null. Email lives only in Keycloak so
// pages that need it pull from useAuth().profile.email, not from this endpoint.
//
// This schema accepts the BE shape AND the legacy FE-expected shape (id/email/
// avatar) so existing consumers keep working. The transform aliases
// keycloakId -> id and avatarUrl -> avatar.
export const userProfileSchema = z
  .object({
    id: z.string().optional(),
    keycloakId: z.string().optional(),
    email: z.string().optional(),
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

/** Response shape for `POST /sellers/register`. */
export const sellerRegisterResponseSchema = z.object({ status: z.string() }).passthrough();
