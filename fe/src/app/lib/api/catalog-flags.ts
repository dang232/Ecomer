const env = import.meta.env as Record<string, string | undefined>;

/** V2 catalog reads are opt-in until their latency and error gates are met. */
export const catalogV2Enabled = env.VITE_CATALOG_V2 === "true";
