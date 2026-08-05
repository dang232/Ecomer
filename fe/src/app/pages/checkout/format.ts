import type { Address } from "@/shared/contracts/api";

export function formatAddressLine(a: Address): string {
  return [a.street, a.ward, a.district, a.city].filter(Boolean).join(", ");
}
