export { IpManager } from './core/IpManager.js';
export type { IpManagerOptions, GeoData, IpEnrichment, IpSnapshot, IpIdentifyContext, IdentifyResult, EnrichedIdentifyResult, } from './types.js';
export { GeoEnricher } from './libs/enrichment/GeoEnricher.js';
export { ProxyEnricher } from './libs/enrichment/ProxyEnricher.js';
export { computeRiskScore } from './libs/enrichment/reputation.js';
export { detectImpossibleTravel, computeRiskDelta, computeConsistencyScore, haversineKm, } from './libs/scoring.js';
export { createIpStorage } from './libs/adapters/inmemory.js';
export type { IpStorage } from './libs/adapters/inmemory.js';
export { createIpMiddleware, resolveIp } from './libs/middleware.js';
//# sourceMappingURL=main.d.ts.map