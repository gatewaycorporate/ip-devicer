import { type AiAgentProvider } from './agents.js';
type AgentInfo = {
    isAiAgent: boolean;
    aiAgentProvider?: AiAgentProvider;
    aiAgentConfidence?: number;
};
/**
 * Classifies IPs as Tor, VPN, proxy, hosting, or AI-agent traffic.
 *
 * Detection blends maintained CIDR lists with optional RDAP lookups so the
 * classifier can fall back to registrant-name heuristics when an address is not
 * covered by the bundled IPv4 ranges.
 */
export declare class ProxyEnricher {
    private readonly torExitListUrl;
    private readonly proxyListPaths;
    private readonly hasLicense;
    private readonly enableRdap;
    private torExitNodes;
    private vpnCidrs;
    private proxyCidrs;
    private aiAgentRanges;
    private readonly hostingCidrs;
    private initDone;
    /**
     * @param torExitListUrl - URL used to refresh the Tor exit-node list.
     * @param proxyListPaths - Optional local CIDR files appended to the built-in VPN/proxy ranges.
     * @param hasLicense - Whether paid-tier list loading should be enabled.
     * @param enableRdap - Whether RDAP lookups may be used as a fallback classifier.
     */
    constructor(torExitListUrl?: string, proxyListPaths?: string[], hasLicense?: boolean, enableRdap?: boolean);
    /**
     * Fetch the Tor exit-node list and any licensed local CIDR files once.
     *
     * Initialization is best-effort: failed downloads or unreadable files do not throw.
     */
    init(): Promise<void>;
    private fetchTorExitNodes;
    private loadProxyFiles;
    /** Return `true` when the IP appears in the cached Tor exit-node list. */
    isTor(ip: string): boolean;
    /**
     * Classify an IP as VPN traffic.
     *
     * Checks the bundled/license-supplied CIDR lists first, then optionally falls
     * back to RDAP organization-name heuristics.
     */
    isVpn(ip: string, rdapInfo?: {
        asn?: number;
        asnOrg?: string;
    }): Promise<boolean>;
    /**
     * Classify an IP as proxy traffic.
     *
     * Checks the bundled/license-supplied CIDR lists first, then optionally falls
     * back to RDAP organization-name heuristics.
     */
    isProxy(ip: string, rdapInfo?: {
        asn?: number;
        asnOrg?: string;
    }): Promise<boolean>;
    /**
     * Classify an IP as datacenter or hosting-provider traffic.
     *
     * Checks known hosting CIDRs first, then optionally falls back to RDAP
     * organization-name heuristics.
     */
    isHosting(ip: string, rdapInfo?: {
        asn?: number;
        asnOrg?: string;
    }): Promise<boolean>;
    private getAiAgentMatch;
    /**
     * Classify whether the IP belongs to a known AI-agent range.
     *
     * Returns the matched provider plus a numeric confidence score when a catalog
     * range applies, otherwise `{ isAiAgent: false }`.
     */
    isAiAgent(ip: string): AgentInfo;
    /**
     * Query ARIN RDAP (falling back to RIPE on 404) to look up the registered
     * network name and origin ASN for a given IPv4 address.
     *
     * Returns `{}` for IPv6 addresses and on any network/parse failure so that
     * callers can always destructure the result safely.
     */
    getRdapInfo(ip: string): Promise<{
        asn?: number;
        asnOrg?: string;
    }>;
    /**
     * Run the full IP classification pass and return all derived flags together.
     *
     * RDAP is looked up once and shared across VPN/proxy/hosting heuristics.
     */
    classifyAll(ip: string): Promise<{
        isTor: boolean;
        isVpn: boolean;
        isProxy: boolean;
        isHosting: boolean;
        agentInfo: AgentInfo;
        rdapInfo: {
            asn?: number;
            asnOrg?: string;
        };
    }>;
    /**
     * Reset cached remote and local lists, then re-run initialization.
     */
    refresh(): Promise<void>;
}
export {};
//# sourceMappingURL=ProxyEnricher.d.ts.map