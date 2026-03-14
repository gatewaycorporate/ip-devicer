import { type AiAgentRange } from './agents.js';
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
    constructor(torExitListUrl?: string, proxyListPaths?: string[], hasLicense?: boolean, enableRdap?: boolean);
    init(): Promise<void>;
    private fetchTorExitNodes;
    private loadProxyFiles;
    isTor(ip: string): boolean;
    isVpn(ip: string): boolean;
    isProxy(ip: string): boolean;
    isHosting(ip: string): boolean;
    getAiAgentMatch(ip: string): Pick<AiAgentRange, 'provider' | 'confidence' | 'source'> | null;
    isAiAgent(ip: string): boolean;
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
    classifyAll(ip: string): Promise<{
        isAiAgent: boolean;
        aiAgentProvider?: AiAgentRange['provider'];
        aiAgentConfidence?: AiAgentRange['confidence'];
        isTor: boolean;
        isVpn: boolean;
        isProxy: boolean;
        isHosting: boolean;
        rdapInfo: {
            asn?: number;
            asnOrg?: string;
        };
    }>;
    refresh(): Promise<void>;
}
//# sourceMappingURL=ProxyEnricher.d.ts.map