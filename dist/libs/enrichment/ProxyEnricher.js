import { readFileSync } from 'node:fs';
/** Default Tor exit node bulk list URL */
const DEFAULT_TOR_URL = 'https://check.torproject.org/torbulkexitlist';
/** Well-known hosting/cloud ASN CIDR prefixes (representative subset) */
const HOSTING_CIDRS = [
    // AWS
    '3.0.0.0/8', '18.0.0.0/8', '52.0.0.0/8', '54.0.0.0/8', '34.0.0.0/8', '35.0.0.0/8',
    // GCP
    '35.185.0.0/16', '35.186.0.0/16', '35.192.0.0/14', '34.64.0.0/10',
    // Azure
    '20.0.0.0/8', '40.64.0.0/10', '13.64.0.0/11',
    // DigitalOcean
    '159.65.0.0/16', '167.99.0.0/16', '138.197.0.0/16', '104.131.0.0/16',
    // Linode/Akamai
    '45.33.0.0/16', '45.56.0.0/16', '172.104.0.0/14',
    // OVH
    '51.68.0.0/16', '51.75.0.0/16', '51.161.0.0/16', '135.125.0.0/16',
    // Hetzner
    '116.202.0.0/15', '136.243.0.0/16', '144.76.0.0/15',
];
function parseCidrs(text) {
    return text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
}
function ipToNumber(ip) {
    return ip
        .split('.')
        .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}
function isInCidr(ip, cidr) {
    // IPv6 – skip CIDR check (only IPv4 CIDRs in our lists)
    if (ip.includes(':'))
        return false;
    const [base, prefixStr] = cidr.split('/');
    if (!base || prefixStr === undefined)
        return false;
    const prefix = parseInt(prefixStr, 10);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipToNumber(ip) & mask) >>> 0 === (ipToNumber(base) & mask) >>> 0;
}
export class ProxyEnricher {
    torExitListUrl;
    proxyListPaths;
    hasLicense;
    torExitNodes = new Set();
    vpnCidrs = [];
    proxyCidrs = [];
    hostingCidrs = HOSTING_CIDRS;
    initDone = false;
    constructor(torExitListUrl = DEFAULT_TOR_URL, proxyListPaths = [], hasLicense = false) {
        this.torExitListUrl = torExitListUrl;
        this.proxyListPaths = proxyListPaths;
        this.hasLicense = hasLicense;
    }
    async init() {
        if (this.initDone)
            return;
        await Promise.allSettled([
            this.fetchTorExitNodes(),
            this.loadProxyFiles(),
        ]);
        this.initDone = true;
    }
    async fetchTorExitNodes() {
        try {
            const res = await fetch(this.torExitListUrl, { signal: AbortSignal.timeout(5000) });
            if (!res.ok)
                return;
            const text = await res.text();
            for (const line of text.split('\n')) {
                const ip = line.trim();
                if (ip && !ip.startsWith('#'))
                    this.torExitNodes.add(ip);
            }
        }
        catch {
            // network unavailable — continue without Tor list
        }
    }
    loadProxyFiles() {
        if (!this.hasLicense)
            return;
        for (const filePath of this.proxyListPaths) {
            try {
                const text = readFileSync(filePath, 'utf8');
                const cidrs = parseCidrs(text);
                // Heuristic: file name determines list type
                if (filePath.toLowerCase().includes('vpn')) {
                    this.vpnCidrs.push(...cidrs);
                }
                else {
                    this.proxyCidrs.push(...cidrs);
                }
            }
            catch {
                // silently skip unreadable files
            }
        }
    }
    isTor(ip) {
        return this.torExitNodes.has(ip);
    }
    isVpn(ip) {
        if (!this.hasLicense)
            return false;
        return this.vpnCidrs.some((cidr) => isInCidr(ip, cidr));
    }
    isProxy(ip) {
        if (!this.hasLicense)
            return false;
        return this.proxyCidrs.some((cidr) => isInCidr(ip, cidr));
    }
    isHosting(ip) {
        return this.hostingCidrs.some((cidr) => isInCidr(ip, cidr));
    }
    classifyAll(ip) {
        return {
            isTor: this.isTor(ip),
            isVpn: this.isVpn(ip),
            isProxy: this.isProxy(ip),
            isHosting: this.isHosting(ip),
        };
    }
    async refresh() {
        this.torExitNodes.clear();
        this.vpnCidrs = [];
        this.proxyCidrs = [];
        this.initDone = false;
        await this.init();
    }
}
