// ── Core ──────────────────────────────────────────────────────
export { IpManager } from './core/IpManager.js';

// ── Licensing ─────────────────────────────────────────────────
export {
  validateLicense,
  evictLicenseCache,
  POLAR_ORGANIZATION_ID,
  POLAR_BENEFIT_IDS,
  FREE_TIER_MAX_DEVICES,
  FREE_TIER_MAX_HISTORY,
} from './libs/license.js';
export type { LicenseTier, LicenseInfo } from './libs/license.js';

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
export { createSqliteIpStorage } from './libs/adapters/sqlite.js';
export { createPostgresIpStorage } from './libs/adapters/postgres.js';
export type { AsyncIpStorage } from './libs/adapters/postgres.js';
export { createRedisIpStorage } from './libs/adapters/redis.js';

// ── Middleware ────────────────────────────────────────────────
export { createIpMiddleware, resolveIp } from './libs/middleware.js';
export type { NextFunction } from './libs/middleware.js';
