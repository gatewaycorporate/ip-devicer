// ────────────────────────────────────────────────────────────
//  ip-devicer — shared types
// ────────────────────────────────────────────────────────────

export interface IpManagerOptions {
  /**
   * Polar license key that unlocks Pro or Enterprise tier features.
   *
   * | Tier         | Price    | Device limit | Servers   |
   * |--------------|---------|--------------|-----------|
   * | Free         | $0/mo    | 10,000       | —         |
   * | Pro          | $49/mo   | Unlimited    | 1 server  |
   * | Enterprise   | $299/mo  | Unlimited    | Unlimited |
   *
   * VPN/proxy detection and extended history require Pro or Enterprise.
   * Obtain a key at https://polar.sh and configure {@link POLAR_ORGANIZATION_ID}
   * and {@link POLAR_BENEFIT_IDS} in `src/libs/license.ts`.
   */
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
  /**
   * Enable RDAP lookups for ASN enrichment. Default: `true`.
   * Set to `false` to skip outbound RDAP network calls entirely.
   */
  enableRdap?: boolean;
  /** Max IP snapshots kept per deviceId in memory. Default: 50 (10 without key) */

  maxHistoryPerDevice?: number;
  /** Minimum km/h speed that triggers impossible-travel alert. Default: 900 */
  impossibleTravelThresholdKmh?: number;
}

// ── Geo / ASN ────────────────────────────────────────────────

export interface GeoData {
  country?: string;         // ISO 3166-1 alpha-2, e.g. "US"
  countryName?: string;     // English display name
  city?: string;
  subdivision?: string;     // First subdivision ISO code
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asn?: number;
  asnOrg?: string;
}

// ── Enrichment result ────────────────────────────────────────

export interface IpEnrichment extends GeoData {
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  isHosting: boolean;
	agentInfo?: {
		isAiAgent: boolean;
		aiAgentProvider?: string;
		aiAgentConfidence?: number; // 0–100
	}
	rdapInfo: { asn?: number; asnOrg?: string };
  riskScore: number;        // 0–100
  riskFactors: string[];
  consistencyScore: number; // 0–100 vs device history
  impossibleTravel: boolean;
}

// ── Storage ──────────────────────────────────────────────────

export interface IpSnapshot {
  id: string;
  deviceId: string;
  timestamp: Date;
  ip: string;
  enrichment: IpEnrichment;
}

// ── Context passed alongside the FP payload ──────────────────

export interface IpIdentifyContext {
  ip?: string;
  userId?: string;
  headers?: Record<string, string | string[] | undefined>;
}

// ── Extended IdentifyResult ───────────────────────────────────

export interface IdentifyResult {
  deviceId: string;
  confidence: number;
  isNewDevice: boolean;
  matchConfidence: number;
  linkedUserId?: string;
  enrichmentInfo: {
    plugins: string[];
    details: Record<string, Record<string, unknown>>;
    failures: Array<{ plugin: string; message: string }>;
  };
}

export interface EnrichedIdentifyResult extends IdentifyResult {
  ipEnrichment?: IpEnrichment;
  ipRiskDelta?: number;
}
