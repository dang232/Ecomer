import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-chapter state for the BA-grade business journey.
 *
 * Each chapter writes the keys downstream chapters need; downstream chapters
 * `requireJourneyState(...)` to fail fast with a clear message when a
 * predecessor didn't run. This keeps every chapter independently rerunnable
 * (Playwright retry semantics + serial workers) without the JSON file
 * silently masking missing setup.
 */
export interface JourneyState {
  // Chapter 1 → all later chapters
  approvedSellerKeycloakId?: string;
  approvedSellerPublicId?: string;
  approvedSellerEmail?: string;
  approvedSellerPassword?: string;
  couponCode?: string;
  couponDiscountVnd?: number;

  // Chapter 2 → 3, 4, 6
  buyerEmail?: string;
  buyerPassword?: string;
  productId?: string;
  productName?: string;
  productUnitPriceVnd?: number;
  orderId?: string;
  orderTotalVnd?: number;
  subOrderId?: number;

  // Chapter 5 → 6
  payoutId?: string;
  payoutAmountVnd?: number;
}

const stateFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "evidence",
  "journey",
  "state.json",
);

export async function readJourneyState(): Promise<JourneyState> {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    return JSON.parse(raw) as JourneyState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function writeJourneyState(patch: Partial<JourneyState>): Promise<void> {
  const current = await readJourneyState();
  const next = { ...current, ...patch };
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/**
 * Loads state and verifies every required key is present + truthy. Throws
 * with the exact list of missing keys so the failed step in REPORT.md
 * shows "BLOCKED — chapter X needs Y from chapter Z".
 */
export async function requireJourneyState<K extends keyof JourneyState>(
  keys: K[],
): Promise<Required<Pick<JourneyState, K>> & JourneyState> {
  const state = await readJourneyState();
  const missing = keys.filter(
    (k) => state[k] === undefined || state[k] === null || state[k] === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `journey state missing required keys: ${missing.join(", ")} — a previous chapter must run first`,
    );
  }
  return state as Required<Pick<JourneyState, K>> & JourneyState;
}

export async function resetJourneyState(): Promise<void> {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, "{}\n", "utf8");
}
