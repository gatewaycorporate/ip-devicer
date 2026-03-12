export interface IpManagerOptions {
    /** BSL-1.1 license key — unlocks VPN/proxy detection and full history */
    licenseKey?: string;
    /** Path to GeoLite2-City.mmdb or GeoIP2-City.mmdb */
    maxmindPath?: string;
    /** Path to GeoLite2-ASN.mmdb or GeoIP2-ASN.mmdb */
    asnPath?: string;
    /** Enable reputation scoring (requires licenseKey for full signals) */
    enableReputation?: boolean;
    /** URL to fetch Tor exit node list from. Default: Tor Project bulk list */
    torExitListUrl?: string;
    /** Paths to plain-text CIDR files for VPN/proxy ranges (one CIDR per line) */
    proxyListPaths?: string[];
    /** Max IP snapshots kept per deviceId in memory. Default: 50 (10 without key) */
    maxHistoryPerDevice?: number;
    /** Minimum km/h speed that triggers impossible-travel alert. Default: 900 */
    impossibleTravelThresholdKmh?: number;
}
export interface GeoData {
    country?: string;
    countryName?: string;
    city?: string;
    subdivision?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    asn?: number;
    asnOrg?: string;
}
export interface IpEnrichment extends GeoData {
    isProxy: boolean;
    isVpn: boolean;
    isTor: boolean;
    isHosting: boolean;
    riskScore: number;
    riskFactors: string[];
    consistencyScore: number;
    impossibleTravel: boolean;
}
export interface IpSnapshot {
    id: string;
    deviceId: string;
    timestamp: Date;
    ip: string;
    enrichment: IpEnrichment;
}
export interface IpIdentifyContext {
    ip?: string;
    userId?: string;
    headers?: Record<string, string | string[] | undefined>;
}
export interface IdentifyResult {
    deviceId: string;
    confidence: number;
    isNewDevice: boolean;
    matchConfidence: number;
    linkedUserId?: string;
}
export interface EnrichedIdentifyResult extends IdentifyResult {
    ipEnrichment?: IpEnrichment;
    ipRiskDelta?: number;
}
//# sourceMappingURL=types.d.ts.map