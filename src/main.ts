// ── Core ──────────────────────────────────────────────────────
export { IpManager } from './core/IpManager.js';

// ── Types ─────────────────────────────────────────────────────
export type {
  IpManagerOptions,
  GeoData,
  IpEnrichment,
  IpSnapshot,
  IpIdentifyContext,
  IdentifyResult,
  EnrichedIdentifyResult,
} from './types.js';

// ── Enrichment ────────────────────────────────────────────────
export { GeoEnricher } from './libs/enrichment/GeoEnricher.js';
export { ProxyEnricher } from './libs/enrichment/ProxyEnricher.js';
export { computeRiskScore } from './libs/enrichment/reputation.js';

// ── Scoring ───────────────────────────────────────────────────
export {
  detectImpossibleTravel,
  computeRiskDelta,
  computeConsistencyScore,
  haversineKm,
} from './libs/scoring.js';

// ── Storage ───────────────────────────────────────────────────
export { createIpStorage } from './libs/adapters/inmemory.js';
export type { IpStorage } from './libs/adapters/inmemory.js';

// ── Middleware ────────────────────────────────────────────────
export { createIpMiddleware, resolveIp } from './libs/middleware.js';
