import pg from 'pg';
import { randomUUID } from 'node:crypto';
import type { IpSnapshot } from '../../types.js';

/**
 * Async version of the storage interface for adapters backed by network-based
 * databases (PostgreSQL, Redis).
 */
export interface AsyncIpStorage {
  /** Initialise the store (create tables / indices if needed). */
  init(): Promise<void>;
  /** Persist a snapshot and return the full record with its generated id. */
  save(snapshot: Omit<IpSnapshot, 'id'>): Promise<IpSnapshot>;
  /** Return snapshots for a device, newest first. */
  getHistory(deviceId: string, limit?: number): Promise<IpSnapshot[]>;
  /** Return the most-recent snapshot for a device, or `null`. */
  getLatest(deviceId: string): Promise<IpSnapshot | null>;
  /** Delete snapshots — all devices if `deviceId` is omitted. */
  clear(deviceId?: string): Promise<void>;
  /** Release connection pool / client. */
  close(): Promise<void>;
  /** Number of unique device IDs currently stored. */
  size(): Promise<number>;
}

/**
 * Create an {@link AsyncIpStorage} backed by a PostgreSQL database via the
 * `pg` package.
 *
 * The adapter creates the `ip_snapshots` table and its index automatically on
 * the first call to `init()`.
 *
 * @param connectionString - PostgreSQL connection string,
 *   e.g. `"postgresql://user:pass@localhost:5432/mydb"`.
 * @param maxPerDevice - Maximum snapshots to retain per deviceId. Default: `50`
 */
export function createPostgresIpStorage(
  connectionString: string,
  maxPerDevice: number = 50,
): AsyncIpStorage {
  const pool = new pg.Pool({ connectionString });

  function rowToSnapshot(row: Record<string, unknown>): IpSnapshot {
    return {
      id: row['id'] as string,
      deviceId: (row['deviceid'] ?? row['deviceId']) as string,
      timestamp: new Date(row['timestamp'] as string),
      ip: row['ip'] as string,
      enrichment:
        typeof row['enrichment'] === 'string'
          ? (JSON.parse(row['enrichment'] as string) as IpSnapshot['enrichment'])
          : (row['enrichment'] as IpSnapshot['enrichment']),
    };
  }

  return {
    async init(): Promise<void> {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ip_snapshots (
          id         TEXT PRIMARY KEY,
          deviceId   TEXT        NOT NULL,
          timestamp  TIMESTAMPTZ NOT NULL,
          ip         TEXT        NOT NULL,
          enrichment JSONB       NOT NULL
        )
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_ip_snapshots_device ON ip_snapshots(deviceId, timestamp DESC)',
      );
    },

    async save(partial): Promise<IpSnapshot> {
      const id = randomUUID();
      const snapshot: IpSnapshot = { ...partial, id };
      await pool.query(
        'INSERT INTO ip_snapshots (id, deviceId, timestamp, ip, enrichment) VALUES ($1, $2, $3, $4, $5)',
        [id, snapshot.deviceId, snapshot.timestamp, snapshot.ip, JSON.stringify(snapshot.enrichment)],
      );
      // Trim old snapshots beyond the per-device cap
      await pool.query(
        `DELETE FROM ip_snapshots
         WHERE deviceId = $1
         AND id NOT IN (
           SELECT id FROM ip_snapshots WHERE deviceId = $1
           ORDER BY timestamp DESC LIMIT $2
         )`,
        [snapshot.deviceId, maxPerDevice],
      );
      return snapshot;
    },

    async getHistory(deviceId, limit = 50): Promise<IpSnapshot[]> {
      const res = await pool.query(
        'SELECT * FROM ip_snapshots WHERE deviceId = $1 ORDER BY timestamp DESC LIMIT $2',
        [deviceId, limit],
      );
      return res.rows.map(rowToSnapshot);
    },

    async getLatest(deviceId): Promise<IpSnapshot | null> {
      const res = await pool.query(
        'SELECT * FROM ip_snapshots WHERE deviceId = $1 ORDER BY timestamp DESC LIMIT 1',
        [deviceId],
      );
      return res.rows[0] ? rowToSnapshot(res.rows[0]) : null;
    },

    async clear(deviceId?: string): Promise<void> {
      if (deviceId !== undefined) {
        await pool.query('DELETE FROM ip_snapshots WHERE deviceId = $1', [deviceId]);
      } else {
        await pool.query('DELETE FROM ip_snapshots');
      }
    },

    async close(): Promise<void> {
      await pool.end();
    },

    async size(): Promise<number> {
      const res = await pool.query(
        'SELECT COUNT(DISTINCT "deviceId") AS n FROM ip_snapshots',
      );
      return Number(res.rows[0].n);
    },
  };
}
