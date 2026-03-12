export declare class ProxyEnricher {
    private readonly torExitListUrl;
    private readonly proxyListPaths;
    private readonly hasLicense;
    private torExitNodes;
    private vpnCidrs;
    private proxyCidrs;
    private readonly hostingCidrs;
    private initDone;
    constructor(torExitListUrl?: string, proxyListPaths?: string[], hasLicense?: boolean);
    init(): Promise<void>;
    private fetchTorExitNodes;
    private loadProxyFiles;
    isTor(ip: string): boolean;
    isVpn(ip: string): boolean;
    isProxy(ip: string): boolean;
    isHosting(ip: string): boolean;
    classifyAll(ip: string): {
        isTor: boolean;
        isVpn: boolean;
        isProxy: boolean;
        isHosting: boolean;
    };
    refresh(): Promise<void>;
}
//# sourceMappingURL=ProxyEnricher.d.ts.map