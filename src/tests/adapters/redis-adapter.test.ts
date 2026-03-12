import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { IpEnrichment } from '../../types.js';

// ─── Lightweight in-memory Redis sorted-set mock ──────────────────────────────

type SortedSetEntry = { score: number; value: string };

function createMockRedis() {
  const store = new Map<string, SortedSetEntry[]>();

  function getSet(key: string): SortedSetEntry[] {
    if (!store.has(key)) store.set(key, []);
    return store.get(key)!;
  }

  const instance = {
    // Sorted set
    zadd: vi.fn(async (_key: string, score: number, value: string) => {
      const set = getSet(_key);
      set.push({ score, value });
      set.sort((a, b) => a.score - b.score); // ascending
      return 1;
    }),
    zcard: vi.fn(async (_key: string) => getSet(_key).length),
    zremrangebyrank: vi.fn(async (_key: string, start: number, stop: number) => {
      const set = getSet(_key);
      const removed = set.splice(start, stop - start + 1);
      return removed.length;
    }),
    zrevrange: vi.fn(async (_key: string, start: number, stop: number) => {
      const set = [...getSet(_key)].reverse(); // highest score first
      const end = stop === -1 ? undefined : stop + 1;
      return set.slice(start, end).map(e => e.value);
    }),
    // Key management
    expire: vi.fn(async () => 1),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) { if (store.delete(k)) count++; }
      return count;
    }),
    scan: vi.fn(async (_cursor: string, _matchKw: string, pattern: string) => {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      const matched = [...store.keys()].filter(k => regex.test(k));
      return ['0', matched]; // single-page scan
    }),
    // Connection
    connect: vi.fn(async () => {}),
    quit: vi.fn(async () => 'OK'),
    // Access internal store for assertions
    _store: store,
  };

  return instance;
}

// ─── Mock `ioredis` module ────────────────────────────────────────────────────

let mockRedisInstance = createMockRedis();

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => mockRedisInstance),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const baseEnrichment: IpEnrichment = {
  isTor: false, isVpn: false, isProxy: false, isHosting: false,
  impossibleTravel: false, riskScore: 0, riskFactors: [], consistencyScore: 100,
};

function partial(deviceId: string, ip: string) {
  return { deviceId, ip, timestamp: new Date(), enrichment: baseEnrichment };
}

describe('createRedisIpStorage', () => {
  let storage: Awaited<ReturnType<typeof import('../../libs/adapters/redis.js').createRedisIpStorage>>;

  beforeEach(async () => {
    mockRedisInstance = createMockRedis();
    const { createRedisIpStorage } = await import('../../libs/adapters/redis.js');
    storage = createRedisIpStorage('redis://mock:6379');
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('init connects to Redis', async () => {
    expect(mockRedisInstance.connect).toHaveBeenCalled();
  });

  it('saves and retrieves snapshots newest-first', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d1', '2.2.2.2'));
    const history = await storage.getHistory('d1');
    expect(history[0].ip).toBe('2.2.2.2');
    expect(history[1].ip).toBe('1.1.1.1');
  });

  it('returns empty array for unknown deviceId', async () => {
    expect(await storage.getHistory('unknown')).toHaveLength(0);
  });

  it('respects limit on getHistory', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d1', '2.2.2.2'));
    await storage.save(partial('d1', '3.3.3.3'));
    const history = await storage.getHistory('d1', 2);
    expect(history).toHaveLength(2);
  });

  it('enforces maxPerDevice cap on save', async () => {
    const { createRedisIpStorage } = await import('../../libs/adapters/redis.js');
    const capped = createRedisIpStorage('redis://mock:6379', 3);
    await capped.init();
    for (let i = 0; i < 5; i++) await capped.save(partial('d1', `10.0.0.${i}`));
    const history = await capped.getHistory('d1', 50);
    expect(history).toHaveLength(3);
  });

  it('getLatest returns most recent or null', async () => {
    expect(await storage.getLatest('d1')).toBeNull();
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d1', '2.2.2.2'));
    const latest = await storage.getLatest('d1');
    expect(latest?.ip).toBe('2.2.2.2');
  });

  it('clear(deviceId) removes only that device', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d2', '2.2.2.2'));
    await storage.clear('d1');
    expect(await storage.getHistory('d1')).toHaveLength(0);
    expect(await storage.getHistory('d2')).toHaveLength(1);
  });

  it('clear() removes all devices via scan+del', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d2', '2.2.2.2'));
    await storage.clear();
    expect(await storage.getHistory('d1')).toHaveLength(0);
    expect(await storage.getHistory('d2')).toHaveLength(0);
  });

  it('each snapshot gets a unique id', async () => {
    const a = await storage.save(partial('d1', '1.1.1.1'));
    const b = await storage.save(partial('d1', '2.2.2.2'));
    expect(a.id).not.toBe(b.id);
  });

  it('timestamp is restored as a Date', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    const snap = await storage.getLatest('d1');
    expect(snap?.timestamp).toBeInstanceOf(Date);
  });

  it('roundtrips enrichment fields', async () => {
    const enrichment: IpEnrichment = {
      ...baseEnrichment,
      country: 'JP',
      city: 'Tokyo',
      asn: 2497,
      riskScore: 10,
      riskFactors: ['hosting'],
    };
    const saved = await storage.save({ deviceId: 'd1', ip: '1.1.1.1', timestamp: new Date(), enrichment });
    const latest = await storage.getLatest('d1');
    expect(latest?.enrichment.country).toBe('JP');
    expect(latest?.enrichment.riskFactors).toEqual(['hosting']);
    expect(latest?.id).toBe(saved.id);
  });

  it('sets TTL on save', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    expect(mockRedisInstance.expire).toHaveBeenCalledWith('ip:device:d1', expect.any(Number));
  });
});
