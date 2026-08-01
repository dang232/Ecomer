import {
  avatarUploadResponseSchema,
  sellerRegisterResponseSchema,
  userProfileSchema,
  type Address,
} from "../../../types/api";
import { findAddressIndexByKey } from "../../address-key";
import { api } from "../client";

export const myProfile = () => api.get("/users/me", userProfileSchema);

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  avatar?: string;
}
export const updateProfile = (body: UpdateProfileInput) =>
  api.put("/users/me", userProfileSchema, body);

// All three address endpoints return the up-to-date BuyerProfileResponse so the
// client never has to merge partial state — see UserController#addAddress et al.
export const addAddress = (body: Address) =>
  api.post("/users/me/addresses", userProfileSchema, body);
export const setDefaultAddress = (key: string, addresses: readonly Address[]) => {
  const index = findAddressIndexByKey(addresses, key);
  if (index === -1) return Promise.reject(new Error("Address not found"));
  return api.put(`/users/me/addresses/${index}/default`, userProfileSchema);
};
export const removeAddress = (key: string, addresses: readonly Address[]) => {
  const index = findAddressIndexByKey(addresses, key);
  if (index === -1) return Promise.reject(new Error("Address not found"));
  return api.delete(`/users/me/addresses/${index}`, userProfileSchema);
};

// Avatar upload: two-phase. /upload signs a PUT URL the browser uses to
// stream the file directly to MinIO; /activate verifies the upload landed
// and stamps the canonical URL on the buyer's profile.
export interface AvatarUploadBody {
  filename: string;
  contentType: string;
  contentLength: number;
  sha256Hex: string;
}
export interface AvatarActivateBody {
  objectKey: string;
  contentLength: number;
  sha256Hex: string;
}
export const avatarUpload = (body: AvatarUploadBody) =>
  api.post("/users/me/avatar/upload", avatarUploadResponseSchema, body);
export const avatarActivate = (body: AvatarActivateBody) =>
  api.post("/users/me/avatar/activate", userProfileSchema, body);

// Seller onboarding
export const registerSeller = (body: { shopName: string; description?: string; phone: string }) =>
  api.post("/sellers/register", sellerRegisterResponseSchema, body);

export const sellerProfile = () => api.get("/sellers/me", userProfileSchema);
