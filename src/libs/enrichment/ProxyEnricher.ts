import { readFileSync } from 'node:fs';

/** Default Tor exit node bulk list URL */
const DEFAULT_TOR_URL = 'https://check.torproject.org/torbulkexitlist';

/**
 * Well-known VPN provider egress CIDR prefixes (representative subset).
 * Sources: published AS/BGP data & provider transparency pages.
 */
const DEFAULT_VPN_CIDRS: string[] = [
  // Mullvad
  '193.138.218.0/24', '185.213.154.0/24', '185.195.232.0/22',
  '91.90.44.0/24', '188.241.83.0/24', '185.65.134.0/24',
  // ProtonVPN
  '185.159.156.0/22', '37.19.198.0/24', '185.107.80.0/22',
  '194.126.177.0/24', '194.126.178.0/24',
  // Windscribe
  '199.116.118.0/24', '104.238.180.0/24', '198.8.83.0/24',
  '104.223.100.0/22',
  // Private Internet Access (PIA)
  '209.222.18.0/24', '209.222.19.0/24', '198.8.80.0/21',
  // IPVanish
  '209.197.24.0/21', '198.8.80.0/21', '66.235.168.0/21',
  // Surfshark
  '45.87.212.0/22', '156.146.34.0/24', '156.146.32.0/22',
  // NordVPN
  '192.145.116.0/24', '185.93.182.0/24', '37.120.135.0/24',
  '89.187.160.0/21',
  // ExpressVPN
  '185.236.200.0/22', '103.108.48.0/22',
  // HideMyAss (HMA)
  '171.22.24.0/22', '77.247.96.0/20',
  // AirVPN
  '185.203.0.0/22', '10.4.0.0/16',
  // TunnelBear
  '216.115.17.0/24', '104.199.0.0/16',
  // VyprVPN (Goldenfrog)
  '81.17.16.0/20', '185.202.220.0/22',
];

/**
 * Well-known public / commercial proxy provider CIDR prefixes (representative subset).
 * Includes open-proxy datacenter blocks and known residential-proxy gateways.
 */
const DEFAULT_PROXY_CIDRS: string[] = [
  // Luminati / Bright Data
  '85.238.100.0/22', '185.130.104.0/22', '154.16.72.0/22',
  // Smartproxy
  '193.8.56.0/21', '85.239.32.0/22',
  // Oxylabs
  '82.102.20.0/24', '82.102.21.0/24', '82.102.22.0/24',
  // PacketStream
  '104.144.138.0/24', '104.144.139.0/24',
  // Storm Proxies
  '198.199.120.0/22', '159.89.48.0/21',
  // NetNut
  '85.203.44.0/22',
  // ProxyMesh
  '67.205.128.0/20',
  // Known open-proxy hosting blocks (Vultr, Choopa)
  '45.76.0.0/16', '45.32.0.0/14', '108.61.0.0/16',
  // GiglinxProxy / proxy.sh
  '46.165.240.0/21',
];

/** Well-known hosting/cloud ASN CIDR prefixes (representative subset) */
const HOSTING_CIDRS: string[] = [
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

function parseCidrs(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function ipToNumber(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isInCidr(ip: string, cidr: string): boolean {
  // IPv6 – skip CIDR check (only IPv4 CIDRs in our lists)
  if (ip.includes(':')) return false;
  const [base, prefixStr] = cidr.split('/');
  if (!base || prefixStr === undefined) return false;
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToNumber(ip) & mask) >>> 0 === (ipToNumber(base) & mask) >>> 0;
}

export class ProxyEnricher {
  private torExitNodes = new Set<string>();
  private vpnCidrs: string[] = [...DEFAULT_VPN_CIDRS];
  private proxyCidrs: string[] = [...DEFAULT_PROXY_CIDRS];
  private readonly hostingCidrs: string[] = HOSTING_CIDRS;
  private initDone = false;

  constructor(
    private readonly torExitListUrl: string = DEFAULT_TOR_URL,
    private readonly proxyListPaths: string[] = [],
    private readonly hasLicense: boolean = false,
  ) {}

  async init(): Promise<void> {
    if (this.initDone) return;
    await Promise.allSettled([
      this.fetchTorExitNodes(),
      this.loadProxyFiles(),
    ]);
    this.initDone = true;
  }

  private async fetchTorExitNodes(): Promise<void> {
    try {
      const res = await fetch(this.torExitListUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const text = await res.text();
      for (const line of text.split('\n')) {
        const ip = line.trim();
        if (ip && !ip.startsWith('#')) this.torExitNodes.add(ip);
      }
    } catch {
      // network unavailable — continue without Tor list
    }
  }

  private loadProxyFiles(): void {
    if (!this.hasLicense || this.proxyListPaths.length === 0) return;
    for (const filePath of this.proxyListPaths) {
      try {
        const text = readFileSync(filePath, 'utf8');
        const cidrs = parseCidrs(text);
        // Heuristic: file name determines list type
        if (filePath.toLowerCase().includes('vpn')) {
          this.vpnCidrs.push(...cidrs);
        } else {
          this.proxyCidrs.push(...cidrs);
        }
      } catch {
        // silently skip unreadable files
      }
    }
  }

  isTor(ip: string): boolean {
    return this.torExitNodes.has(ip);
  }

  isVpn(ip: string): boolean {
    return this.vpnCidrs.some((cidr) => isInCidr(ip, cidr));
  }

  isProxy(ip: string): boolean {
    return this.proxyCidrs.some((cidr) => isInCidr(ip, cidr));
  }

  isHosting(ip: string): boolean {
    return this.hostingCidrs.some((cidr) => isInCidr(ip, cidr));
  }

  classifyAll(ip: string): {
    isTor: boolean;
    isVpn: boolean;
    isProxy: boolean;
    isHosting: boolean;
  } {
    return {
      isTor: this.isTor(ip),
      isVpn: this.isVpn(ip),
      isProxy: this.isProxy(ip),
      isHosting: this.isHosting(ip),
    };
  }

  async refresh(): Promise<void> {
    this.torExitNodes.clear();
    this.vpnCidrs = [...DEFAULT_VPN_CIDRS];
    this.proxyCidrs = [...DEFAULT_PROXY_CIDRS];
    this.initDone = false;
    await this.init();
  }
}
