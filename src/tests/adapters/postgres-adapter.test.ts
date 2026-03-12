import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { IpEnrichment } from '../../types.js';

// ─── Lightweight in-memory Postgres mock ──────────────────────────────────────

type Row = { id: string; deviceId: string; timestamp: Date; ip: string; enrichment: unknown; seq: number };

function createMockPool() {
  const rows: Row[] = [];
  let seq = 0;

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    // CREATE TABLE / INDEX
    if (/^CREATE (TABLE|INDEX)/i.test(s)) return { rows: [] };

    // INSERT
    if (/^INSERT INTO ip_snapshots/i.test(s)) {
      const [id, deviceId, timestamp, ip, enrichment] = params as [string, string, Date, string, string];
      rows.push({ id, deviceId, timestamp: new Date(timestamp), ip, enrichment: JSON.parse(enrichment), seq: seq++ });
      return { rows: [] };
    }

    // DELETE WHERE deviceId = $1 AND id NOT IN (SELECT ... LIMIT $2)  ← trim
    if (/DELETE FROM ip_snapshots\s+WHERE deviceId = \$1\s+AND id NOT IN/i.test(s)) {
      const [deviceId, limit] = params as [string, number];
      const deviceRows = rows
        .filter(r => r.deviceId === deviceId)
        .sort((a, b) => b.seq - a.seq); // insertion order desc (latest first)
      const keep = new Set(deviceRows.slice(0, limit).map(r => r.id));
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].deviceId === deviceId && !keep.has(rows[i].id)) {
          rows.splice(i, 1);
        }
      }
      return { rows: [] };
    }

    // DELETE WHERE deviceId = $1  ← clear(deviceId)
    if (/^DELETE FROM ip_snapshots\s+WHERE deviceId = \$1$/i.test(s)) {
      const [deviceId] = params as [string];
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].deviceId === deviceId) rows.splice(i, 1);
      }
      return { rows: [] };
    }

    // DELETE FROM ip_snapshots  ← clear()
    if (/^DELETE FROM ip_snapshots$/i.test(s)) {
      rows.splice(0);
      return { rows: [] };
    }

    // SELECT … ORDER BY timestamp DESC LIMIT $2  ← getHistory (limit)
    if (/^SELECT \* FROM ip_snapshots WHERE deviceId = \$1 ORDER BY timestamp DESC LIMIT \$2$/i.test(s)) {
      const [deviceId, limit] = params as [string, number];
      return {
        rows: rows
          .filter(r => r.deviceId === deviceId)
          .sort((a, b) => b.seq - a.seq)
          .slice(0, limit),
      };
    }

    // SELECT … ORDER BY timestamp DESC LIMIT 1  ← getLatest
    if (/^SELECT \* FROM ip_snapshots WHERE deviceId = \$1 ORDER BY timestamp DESC LIMIT 1$/i.test(s)) {
      const [deviceId] = params as [string];
      const result = rows
        .filter(r => r.deviceId === deviceId)
        .sort((a, b) => b.seq - a.seq)
        .slice(0, 1);
      return { rows: result };
    }

    return { rows: [] };
  });

  return { query, end: vi.fn(async () => {}), rows };
}

// ─── Mock `pg` module ─────────────────────────────────────────────────────────

let mockPool = createMockPool();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => mockPool),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const baseEnrichment: IpEnrichment = {
  isTor: false, isVpn: false, isProxy: false, isHosting: false,
  impossibleTravel: false, riskScore: 0, riskFactors: [], consistencyScore: 100,
};

function partial(deviceId: string, ip: string) {
  return { deviceId, ip, timestamp: new Date(), enrichment: baseEnrichment };
}

describe('createPostgresIpStorage', () => {
  let storage: Awaited<ReturnType<typeof import('../../libs/adapters/postgres.js').createPostgresIpStorage>>;

  beforeEach(async () => {
    // Fresh pool for each test
    mockPool = createMockPool();
    const { createPostgresIpStorage } = await import('../../libs/adapters/postgres.js');
    storage = createPostgresIpStorage('postgresql://mock:5432/test');
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('init creates table and index', async () => {
    // init was already called in beforeEach — just check query was invoked
    const calls = mockPool.query.mock.calls.map(c => c[0] as string);
    expect(calls.some(s => /CREATE TABLE IF NOT EXISTS ip_snapshots/i.test(s))).toBe(true);
    expect(calls.some(s => /CREATE INDEX IF NOT EXISTS/i.test(s))).toBe(true);
  });

  it('saves and retrieves snapshots newest-first', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d1', '2.2.2.2'));
    const history = await storage.getHistory('d1');
    expect(history[0].ip).toBe('2.2.2.2');
    expect(history[1].ip).toBe('1.1.1.1');
  });

  it('returns empty array for unknown deviceId', async () => {
    const history = await storage.getHistory('unknown');
    expect(history).toHaveLength(0);
  });

  it('respects limit on getHistory', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d1', '2.2.2.2'));
    await storage.save(partial('d1', '3.3.3.3'));
    const history = await storage.getHistory('d1', 2);
    expect(history).toHaveLength(2);
  });

  it('enforces maxPerDevice cap on save', async () => {
    const { createPostgresIpStorage } = await import('../../libs/adapters/postgres.js');
    const capped = createPostgresIpStorage('postgresql://mock/test', 3);
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
    expect(await storage.getHistory('d1', 50)).toHaveLength(0);
    expect(await storage.getHistory('d2', 50)).toHaveLength(1);
  });

  it('clear() removes all devices', async () => {
    await storage.save(partial('d1', '1.1.1.1'));
    await storage.save(partial('d2', '2.2.2.2'));
    await storage.clear();
    expect(await storage.getHistory('d1', 50)).toHaveLength(0);
    expect(await storage.getHistory('d2', 50)).toHaveLength(0);
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
      country: 'DE',
      city: 'Berlin',
      asn: 3320,
      riskScore: 55,
      riskFactors: ['proxy'],
    };
    const snap = await storage.save({ deviceId: 'd1', ip: '1.2.3.4', timestamp: new Date(), enrichment });
    const latest = await storage.getLatest('d1');
    expect(latest?.enrichment.country).toBe('DE');
    expect(latest?.enrichment.riskFactors).toEqual(['proxy']);
    expect(latest?.id).toBe(snap.id);
  });
});
