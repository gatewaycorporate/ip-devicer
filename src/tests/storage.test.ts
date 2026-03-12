import { describe, it, expect, beforeEach } from 'vitest';
import { createIpStorage } from '../libs/storage.js';
import type { IpEnrichment } from '../types.js';

const baseEnrichment: IpEnrichment = {
  isTor: false, isVpn: false, isProxy: false, isHosting: false,
  impossibleTravel: false, riskScore: 0, riskFactors: [], consistencyScore: 100,
};

function partial(deviceId: string, ip: string) {
  return { deviceId, ip, timestamp: new Date(), enrichment: baseEnrichment };
}

describe('createIpStorage', () => {
  it('saves and retrieves snapshots newest-first', () => {
    const s = createIpStorage();
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d1', '2.2.2.2'));
    const history = s.getHistory('d1');
    expect(history[0].ip).toBe('2.2.2.2');
    expect(history[1].ip).toBe('1.1.1.1');
  });

  it('returns empty array for unknown deviceId', () => {
    const s = createIpStorage();
    expect(s.getHistory('unknown')).toHaveLength(0);
  });

  it('respects limit', () => {
    const s = createIpStorage();
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d1', '2.2.2.2'));
    s.save(partial('d1', '3.3.3.3'));
    expect(s.getHistory('d1', 2)).toHaveLength(2);
  });

  it('enforces maxPerDevice cap', () => {
    const s = createIpStorage(3);
    for (let i = 0; i < 5; i++) s.save(partial('d1', `10.0.0.${i}`));
    expect(s.getHistory('d1')).toHaveLength(3);
  });

  it('getLatest returns most recent or null', () => {
    const s = createIpStorage();
    expect(s.getLatest('d1')).toBeNull();
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d1', '2.2.2.2'));
    expect(s.getLatest('d1')?.ip).toBe('2.2.2.2');
  });

  it('clear(deviceId) removes only that device', () => {
    const s = createIpStorage();
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d2', '2.2.2.2'));
    s.clear('d1');
    expect(s.getHistory('d1')).toHaveLength(0);
    expect(s.getHistory('d2')).toHaveLength(1);
  });

  it('clear() removes all', () => {
    const s = createIpStorage();
    s.save(partial('d1', '1.1.1.1'));
    s.save(partial('d2', '2.2.2.2'));
    s.clear();
    expect(s.getHistory('d1')).toHaveLength(0);
    expect(s.getHistory('d2')).toHaveLength(0);
  });

  it('each snapshot gets a unique id', () => {
    const s = createIpStorage();
    const a = s.save(partial('d1', '1.1.1.1'));
    const b = s.save(partial('d1', '2.2.2.2'));
    expect(a.id).not.toBe(b.id);
  });
});
