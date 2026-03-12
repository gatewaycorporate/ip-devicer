import { describe, it, expect } from 'vitest';
import { ProxyEnricher } from '../libs/enrichment/ProxyEnricher.js';

describe('ProxyEnricher (no network)', () => {
  it('classifies a known Tor-like IP correctly after manual inject', async () => {
    const pe = new ProxyEnricher(undefined, [], false);
    // Bypass network init for unit test — access private via cast
    (pe as unknown as { torExitNodes: Set<string>; initDone: boolean })
      .torExitNodes.add('198.51.100.42');
    (pe as unknown as { initDone: boolean }).initDone = true;

    expect(pe.isTor('198.51.100.42')).toBe(true);
    expect(pe.isTor('1.2.3.4')).toBe(false);
  });

  it('classifyAll returns false for all when no lists loaded', () => {
    const pe = new ProxyEnricher(undefined, [], false);
    (pe as unknown as { initDone: boolean }).initDone = true;
    const result = pe.classifyAll('8.8.8.8');
    expect(result.isTor).toBe(false);
    expect(result.isVpn).toBe(false);
    expect(result.isProxy).toBe(false);
  });

  it('detects hosting IPs from built-in CIDR list', () => {
    const pe = new ProxyEnricher(undefined, [], false);
    (pe as unknown as { initDone: boolean }).initDone = true;
    // 52.x.x.x — AWS range
    expect(pe.isHosting('52.10.50.1')).toBe(true);
    // 20.x.x.x — Azure range
    expect(pe.isHosting('20.56.1.1')).toBe(true);
    // Regular residential
    expect(pe.isHosting('203.0.113.5')).toBe(false);
  });

  it('does not detect VPN without license', () => {
    const pe = new ProxyEnricher(undefined, [], false);
    (pe as unknown as { vpnCidrs: string[]; initDone: boolean })
      .vpnCidrs.push('10.0.0.0/8');
    (pe as unknown as { initDone: boolean }).initDone = true;
    expect(pe.isVpn('10.0.0.1')).toBe(false);
  });

  it('detects VPN with license', () => {
    const pe = new ProxyEnricher(undefined, [], true);
    (pe as unknown as { vpnCidrs: string[]; initDone: boolean })
      .vpnCidrs.push('10.0.0.0/8');
    (pe as unknown as { initDone: boolean }).initDone = true;
    expect(pe.isVpn('10.0.0.1')).toBe(true);
    expect(pe.isVpn('192.168.1.1')).toBe(false);
  });
});
