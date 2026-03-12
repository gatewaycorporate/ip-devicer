import { describe, it, expect, beforeEach } from 'vitest';
import { createSqliteIpStorage } from '../../libs/adapters/sqlite.js';
import type { IpEnrichment } from '../../types.js';

const baseEnrichment: IpEnrichment = {
  isTor: false, isVpn: false, isProxy: false, isHosting: false,
  impossibleTravel: false, riskScore: 0, riskFactors: [], consistencyScore: 100,
};

function partial(deviceId: string, ip: string) {
  return { deviceId, ip, timestamp: new Date(), enrichment: baseEnrichment };
}

describe('createSqliteIpStorage', () => {
  let s: ReturnType<typeof createSqliteIpStorage>;

  beforeEach(() => {
    // Each test gets a fresh in-memory database
    s = createSqliteIpStorage(':memory:');
  });

  it('saves and retrieves snapshots newest-first', () => {
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d1', '2.2.2.2'));
    const history = s.getHistory('d1');
    expect(history[0].ip).toBe('2.2.2.2');
    expect(history[1].ip).toBe('1.1.1.1');
  });

  it('returns empty array for unknown deviceId', () => {
    expect(s.getHistory('unknown')).toHaveLength(0);
  });

  it('respects limit', () => {
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d1', '2.2.2.2'));
    s.save(partial('d1', '3.3.3.3'));
    expect(s.getHistory('d1', 2)).toHaveLength(2);
  });

  it('enforces maxPerDevice cap', () => {
    const store = createSqliteIpStorage(':memory:', 3);
    for (let i = 0; i < 5; i++) store.save(partial('d1', `10.0.0.${i}`));
    expect(store.getHistory('d1')).toHaveLength(3);
  });

  it('keeps the newest entries when cap is enforced', () => {
    const store = createSqliteIpStorage(':memory:', 2);
    for (let i = 0; i < 4; i++) store.save(partial('d1', `10.0.0.${i}`));
    const history = store.getHistory('d1');
    expect(history).toHaveLength(2);
    // Newest two should be 10.0.0.3 and 10.0.0.2
    expect(history.map(h => h.ip)).toContain('10.0.0.3');
    expect(history.map(h => h.ip)).toContain('10.0.0.2');
  });

  it('getLatest returns most recent or null', () => {
    expect(s.getLatest('d1')).toBeNull();
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d1', '2.2.2.2'));
    expect(s.getLatest('d1')?.ip).toBe('2.2.2.2');
  });

  it('clear(deviceId) removes only that device', () => {
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d2', '2.2.2.2'));
    s.clear('d1');
    expect(s.getHistory('d1')).toHaveLength(0);
    expect(s.getHistory('d2')).toHaveLength(1);
  });

  it('clear() removes all devices', () => {
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d2', '2.2.2.2'));
    s.clear();
    expect(s.getHistory('d1')).toHaveLength(0);
    expect(s.getHistory('d2')).toHaveLength(0);
  });

  it('each snapshot gets a unique id', () => {
    const a = s.save(partial('d1', '1.1.1.1'));
    const b = s.save(partial('d1', '2.2.2.2'));
    expect(a.id).not.toBe(b.id);
  });

  it('isolates snapshots per device', () => {
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d2', '9.9.9.9'));
    expect(s.getHistory('d1')).toHaveLength(1);
    expect(s.getHistory('d2')).toHaveLength(1);
    expect(s.getHistory('d1')[0].ip).toBe('1.1.1.1');
  });

  it('roundtrips enrichment fields', () => {
    const enrichment: IpEnrichment = {
      ...baseEnrichment,
      country: 'US',
      city: 'New York',
      asn: 15169,
      asnOrg: 'GOOGLE',
      riskScore: 42,
      riskFactors: ['vpn', 'tor'],
    };
    const snap = s.save({ deviceId: 'd1', ip: '8.8.8.8', timestamp: new Date(), enrichment });
    const retrieved = s.getLatest('d1');
    expect(retrieved?.enrichment.country).toBe('US');
    expect(retrieved?.enrichment.riskFactors).toEqual(['vpn', 'tor']);
    expect(retrieved?.enrichment.asn).toBe(15169);
    expect(retrieved?.id).toBe(snap.id);
  });

  it('timestamp is restored as a Date', () => {
    s.save(partial('d1', '1.1.1.1'));
    const snap = s.getLatest('d1');
    expect(snap?.timestamp).toBeInstanceOf(Date);
  });
});
