import type { IpEnrichment, IpSnapshot } from '../types.js';
/**
 * Compute great-circle distance between two latitude/longitude coordinates.
 *
 * Uses the Haversine formula and returns the approximate surface distance
 * in kilometers.
 */
export declare function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Detect whether two geolocated events imply travel faster than the allowed threshold.
 *
 * When both timestamps are identical, any non-zero distance is treated as impossible
 * travel because no elapsed time is available to justify movement.
 *
 * @param current - Current observation with coordinates and timestamp.
 * @param last - Previous observation with coordinates and timestamp.
 * @param thresholdKmh - Maximum plausible travel speed in kilometers per hour.
 */
export declare function detectImpossibleTravel(current: {
    lat: number;
    lon: number;
    ts: Date;
}, last: {
    lat: number;
    lon: number;
    ts: Date;
}, thresholdKmh: number): boolean;
/**
 * Compare the current IP risk score to the device's historical average.
 *
 * Positive values indicate the current request is riskier than the recent
 * baseline; negative values indicate it is less risky.
 *
 * @param current - Current enrichment result for the incoming IP.
 * @param history - Historical IP snapshots for the same device.
 * @returns Signed delta relative to the average historical `riskScore`.
 */
export declare function computeRiskDelta(current: IpEnrichment, history: IpSnapshot[]): number;
/**
 * Score how closely the current IP enrichment matches the latest device history.
 *
 * The score is a weighted sum of country (40), ASN (30), city (20), and
 * network-flag consistency (10). Missing values are treated as neutral so they
 * do not penalize the score.
 *
 * @param current - Current enrichment result for the incoming IP.
 * @param history - Historical IP snapshots for the same device, newest first.
 * @returns Consistency score in `[0, 100]` where `100` means fully consistent.
 */
export declare function computeConsistencyScore(current: IpEnrichment, history: IpSnapshot[]): number;
//# sourceMappingURL=scoring.d.ts.map