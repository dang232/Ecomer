import { z } from "zod";

import { emptyResponseSchema } from "../../../types/api/shared";
import { api } from "../client";

const passwordResetResponseSchema = z.object({ accepted: z.boolean() }).loose();

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/**
 * Unauthenticated registration. On success the backend returns 2xx with no
 * payload (the FE auto-logs in via passwordLogin). On failure the interceptor
 * chain throws an ApiError carrying the backend's errorCode/message.
 *
 * credentials: "include" so the backend can set the httpOnly refresh-token
 * cookie on the response (matches the legacy raw fetch behavior).
 */
export const registerUser = (input: RegisterInput) =>
  api.post("/auth/register", emptyResponseSchema, input, {
    auth: false,
    credentials: "include",
  });

export const requestPasswordReset = (email: string, signal?: AbortSignal) =>
  api.post(
    "/auth/password-reset-request",
    passwordResetResponseSchema,
    { email },
    { auth: false, credentials: "include", signal },
  );
