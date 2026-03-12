import { randomUUID } from 'node:crypto';
import type { IpSnapshot } from '../types.js';

export interface IpStorage {
  save(snapshot: Omit<IpSnapshot, 'id'>): IpSnapshot;
  getHistory(deviceId: string, limit?: number): IpSnapshot[];
  getLatest(deviceId: string): IpSnapshot | null;
  clear(deviceId?: string): void;
}

export function createIpStorage(maxPerDevice: number = 50): IpStorage {
  const store = new Map<string, IpSnapshot[]>();

  function getList(deviceId: string): IpSnapshot[] {
    if (!store.has(deviceId)) store.set(deviceId, []);
    return store.get(deviceId)!;
  }

  return {
    save(partial): IpSnapshot {
      const snapshot: IpSnapshot = { ...partial, id: randomUUID() };
      const list = getList(snapshot.deviceId);
      // newest first
      list.unshift(snapshot);
      if (list.length > maxPerDevice) list.splice(maxPerDevice);
      return snapshot;
    },

    getHistory(deviceId, limit): IpSnapshot[] {
      const list = getList(deviceId);
      return limit !== undefined ? list.slice(0, limit) : list.slice();
    },

    getLatest(deviceId): IpSnapshot | null {
      return getList(deviceId)[0] ?? null;
    },

    clear(deviceId?: string): void {
      if (deviceId !== undefined) {
        store.delete(deviceId);
      } else {
        store.clear();
      }
    },
  };
}
