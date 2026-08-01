/**
 * V2 cursor reads are the only buyer catalog path. The old environment flag
 * is intentionally no longer a rollout switch; keeping this export avoids a
 * broad import churn for callers while making the production default explicit.
 */
export const catalogV2Enabled = true;
