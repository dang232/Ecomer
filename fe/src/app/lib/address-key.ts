import type { Address } from "../types/api";

/**
 * Spec U-9: address mutations use stable identity, not array index.
 *
 * The BE /users/me/addresses endpoints do not currently expose a stable
 * `id`/`_id` field on each Address (the AddressResponse shape only carries
 * street/ward/district/city/isDefault), but the FE needs a way to identify
 * a specific address across re-renders. So we derive a stable key client
 * side from the immutable address content.
 *
 * `phone` and `isDefault` are intentionally excluded — toggling default
 * state or editing a phone number must not orphan the key.
 */
export function addressKey(address: Address): string {
  const parts = [
    address.street ?? "",
    address.ward ?? "",
    address.district ?? "",
    address.city ?? "",
  ];
  return parts.join("|");
}

/**
 * Resolve a previously-derived {@link addressKey} back to the array index in
 * the caller's current address list. Returns -1 when the key is no longer
 * present (e.g. the address was deleted in another tab). The FE mutation
 * callers use this to translate the key-based UI identity to the index
 * the BE's /addresses/{index}/default endpoint actually expects.
 */
export function findAddressIndexByKey(addresses: readonly Address[], key: string): number {
  return addresses.findIndex((a) => addressKey(a) === key);
}
