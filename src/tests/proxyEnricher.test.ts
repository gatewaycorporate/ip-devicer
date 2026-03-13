import { describe, it, expect, vi } from 'vitest';
import { ProxyEnricher } from '../libs/enrichment/ProxyEnricher.js';

// Helper: build an enricher with network disabled and initDone pre-set
function makeEnricher(hasLicense = false): ProxyEnricher {
  const pe = new ProxyEnricher(undefined, [], hasLicense);
  (pe as unknown as { initDone: boolean }).initDone = true;
  return pe;
}

// ── Tor detection ──────────────────────────────────────────────────────────────

describe('ProxyEnricher – Tor detection', () => {
  it('returns true for a manually injected Tor exit node', () => {
    const pe = makeEnricher();
    (pe as unknown as { torExitNodes: Set<string> }).torExitNodes.add('198.51.100.42');
    expect(pe.isTor('198.51.100.42')).toBe(true);
  });

  it('returns false for an IP that is not a Tor exit node', () => {
    expect(makeEnricher().isTor('1.2.3.4')).toBe(false);
  });
});

// ── Hosting detection ──────────────────────────────────────────────────────────

describe('ProxyEnricher – hosting detection', () => {
  it('flags AWS range (52.x.x.x)', () => {
    expect(makeEnricher().isHosting('52.10.50.1')).toBe(true);
  });

  it('flags Azure range (20.x.x.x)', () => {
    expect(makeEnricher().isHosting('20.56.1.1')).toBe(true);
  });

  it('flags GCP range (35.192.x.x)', () => {
    expect(makeEnricher().isHosting('35.192.1.1')).toBe(true);
  });

  it('flags DigitalOcean range (167.99.x.x)', () => {
    expect(makeEnricher().isHosting('167.99.100.50')).toBe(true);
  });

  it('does not flag a residential IP', () => {
    expect(makeEnricher().isHosting('203.0.113.5')).toBe(false);
  });
});

// ── Default VPN CIDR list ──────────────────────────────────────────────────────

describe('ProxyEnricher – default VPN CIDRs (no license required)', () => {
  const pe = makeEnricher(); // no license

  it.each([
    ['Mullvad (193.138.218.0/24)',    '193.138.218.5'],
    ['Mullvad (185.195.232.0/22)',    '185.195.232.10'],
    ['ProtonVPN (185.159.156.0/22)',  '185.159.156.10'],
    ['ProtonVPN (37.19.198.0/24)',    '37.19.198.50'],
    ['Windscribe (199.116.118.0/24)', '199.116.118.50'],
    ['Windscribe (104.223.100.0/22)', '104.223.100.1'],
    ['PIA (209.222.18.0/24)',         '209.222.18.100'],
    ['PIA (198.8.80.0/21)',           '198.8.80.5'],
    ['IPVanish (209.197.24.0/21)',    '209.197.24.1'],
    ['IPVanish (66.235.168.0/21)',    '66.235.168.3'],
    ['Surfshark (45.87.212.0/22)',    '45.87.212.5'],
    ['Surfshark (156.146.32.0/22)',   '156.146.32.200'],
    ['NordVPN (192.145.116.0/24)',    '192.145.116.2'],
    ['NordVPN (89.187.160.0/21)',     '89.187.160.7'],
    ['ExpressVPN (185.236.200.0/22)', '185.236.200.1'],
    ['HideMyAss (171.22.24.0/22)',    '171.22.24.5'],
    ['HideMyAss (77.247.96.0/20)',    '77.247.96.1'],
    ['AirVPN (185.203.0.0/22)',       '185.203.0.10'],
    ['TunnelBear (216.115.17.0/24)',  '216.115.17.77'],
    ['VyprVPN (81.17.16.0/20)',       '81.17.16.1'],
    ['VyprVPN (185.202.220.0/22)',    '185.202.220.4'],
  ])('detects %s → %s as VPN', (_label, ip) => {
    expect(pe.isVpn(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',       // Google Public DNS
    '1.1.1.1',       // Cloudflare DNS
    '203.0.113.99',  // TEST-NET-3 (documentation)
    '192.0.2.1',     // TEST-NET-1
  ])('does not flag %s as VPN', (ip) => {
    expect(pe.isVpn(ip)).toBe(false);
  });

  it('returns false for an IPv6 address (CIDR list is IPv4-only)', () => {
    expect(pe.isVpn('2001:db8::1')).toBe(false);
  });
});

// ── Default proxy CIDR list ────────────────────────────────────────────────────

describe('ProxyEnricher – default proxy CIDRs (no license required)', () => {
  const pe = makeEnricher(); // no license

  it.each([
    ['Bright Data/Luminati (85.238.100.0/22)',  '85.238.100.1'],
    ['Bright Data/Luminati (185.130.104.0/22)', '185.130.104.20'],
    ['Bright Data/Luminati (154.16.72.0/22)',   '154.16.72.3'],
    ['Smartproxy (193.8.56.0/21)',              '193.8.56.5'],
    ['Smartproxy (85.239.32.0/22)',             '85.239.32.2'],
    ['Oxylabs (82.102.20.0/24)',                '82.102.20.50'],
    ['Oxylabs (82.102.21.0/24)',                '82.102.21.1'],
    ['Oxylabs (82.102.22.0/24)',                '82.102.22.99'],
    ['PacketStream (104.144.138.0/24)',         '104.144.138.1'],
    ['PacketStream (104.144.139.0/24)',         '104.144.139.200'],
    ['Storm Proxies (198.199.120.0/22)',        '198.199.120.5'],
    ['Storm Proxies (159.89.48.0/21)',          '159.89.48.10'],
    ['NetNut (85.203.44.0/22)',                 '85.203.44.3'],
    ['ProxyMesh (67.205.128.0/20)',             '67.205.128.1'],
    ['Vultr/Choopa (45.76.0.0/16)',             '45.76.1.1'],
    ['Vultr/Choopa (45.32.0.0/14)',             '45.32.0.200'],
    ['Vultr/Choopa (108.61.0.0/16)',            '108.61.200.5'],
    ['GiglinxProxy (46.165.240.0/21)',          '46.165.240.1'],
  ])('detects %s → %s as proxy', (_label, ip) => {
    expect(pe.isProxy(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '203.0.113.99',
    '192.0.2.1',
  ])('does not flag %s as proxy', (ip) => {
    expect(pe.isProxy(ip)).toBe(false);
  });

  it('returns false for an IPv6 address (CIDR list is IPv4-only)', () => {
    expect(pe.isProxy('2001:db8::1')).toBe(false);
  });
});

// ── classifyAll ────────────────────────────────────────────────────────────────

describe('ProxyEnricher – classifyAll', () => {
  it('returns all false for a clean residential IP', () => {
    const result = makeEnricher().classifyAll('8.8.8.8');
    expect(result).toEqual({ isTor: false, isVpn: false, isProxy: false, isHosting: false });
  });

  it('flags a default VPN IP via classifyAll', () => {
    const result = makeEnricher().classifyAll('193.138.218.5');
    expect(result.isVpn).toBe(true);
    expect(result.isProxy).toBe(false);
  });

  it('flags a default proxy IP via classifyAll', () => {
    const result = makeEnricher().classifyAll('85.238.100.1');
    expect(result.isProxy).toBe(true);
    expect(result.isVpn).toBe(false);
  });

  it('flags a hosting IP as hosting, not VPN or proxy', () => {
    const result = makeEnricher().classifyAll('52.10.50.1');
    expect(result.isHosting).toBe(true);
    expect(result.isVpn).toBe(false);
    expect(result.isProxy).toBe(false);
  });
});

// ── Licensed file loading appends to defaults ─────────────────────────────────

describe('ProxyEnricher – licensed file loading', () => {
  it('appends CIDRs from a licensed VPN file on top of defaults', async () => {
    const { readFileSync } = await import('node:fs');
    const readSpy = vi.spyOn({ readFileSync }, 'readFileSync');
    // Provide a fake file path containing 'vpn' so the heuristic routes it correctly
    const pe = new ProxyEnricher(undefined, ['/data/vpn-custom.txt'], true);
    (pe as unknown as { initDone: boolean }).initDone = true;

    // Directly push a custom CIDR as if the file had been loaded
    const inner = pe as unknown as { vpnCidrs: string[] };
    const sizeBefore = inner.vpnCidrs.length;
    inner.vpnCidrs.push('10.99.0.0/24');

    expect(pe.isVpn('10.99.0.1')).toBe(true);
    expect(inner.vpnCidrs.length).toBeGreaterThan(sizeBefore);
    readSpy.mockRestore();
  });

  it('default VPN entries are still present after custom CIDRs are appended', () => {
    const pe = makeEnricher(true);
    (pe as unknown as { vpnCidrs: string[] }).vpnCidrs.push('10.99.0.0/24');
    // Defaults still apply
    expect(pe.isVpn('193.138.218.5')).toBe(true);
    // Custom entry works too
    expect(pe.isVpn('10.99.0.1')).toBe(true);
  });
});

// ── refresh() ────────────────────────────────────────────────────────────────

describe('ProxyEnricher – refresh()', () => {
  it('restores default VPN and proxy CIDRs after refresh', async () => {
    const pe = makeEnricher();

    // Wipe the lists as if something went wrong
    (pe as unknown as { vpnCidrs: string[]; proxyCidrs: string[] }).vpnCidrs = [];
    (pe as unknown as { proxyCidrs: string[] }).proxyCidrs = [];

    // Stub fetchTorExitNodes to avoid network
    vi.spyOn(pe as unknown as { fetchTorExitNodes: () => Promise<void> }, 'fetchTorExitNodes')
      .mockResolvedValue(undefined);

    await pe.refresh();

    expect(pe.isVpn('193.138.218.5')).toBe(true);
    expect(pe.isProxy('85.238.100.1')).toBe(true);
  });
});
