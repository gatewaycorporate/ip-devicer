import { describe, it, expect, vi } from 'vitest';
import { IpManager } from '../core/IpManager.js';
import type { IdentifyResult, EnrichedIdentifyResult } from '../types.js';

// ── registerWith ───────────────────────────────────────────────

describe('IpManager.registerWith', () => {
  it('enriches IdentifyResult with ipEnrichment when ip is provided', async () => {
    const manager = new IpManager({ enableReputation: false });

    // Mock GeoEnricher and ProxyEnricher to avoid real network/mmdb
    const geoEnrich = vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({
      country: 'US', countryName: 'United States',
      city: 'Mountain View', asn: 15169, asnOrg: 'Google LLC',
      latitude: 37.386, longitude: -122.084, timezone: 'America/Los_Angeles',
    });

    // Skip proxy init
    const proxyInit = vi.spyOn(
      (manager as unknown as { proxy: { init: () => unknown } }).proxy,
      'init',
    ).mockResolvedValue(undefined);

    const proxyClassify = vi.spyOn(
      (manager as unknown as { proxy: { classifyAll: () => unknown } }).proxy,
      'classifyAll',
    ).mockReturnValue({ isTor: false, isVpn: false, isProxy: false, isHosting: false });

    const baseResult: IdentifyResult = {
      deviceId: 'dev_abc', confidence: 90, isNewDevice: false, matchConfidence: 85,
    };

    const deviceManager = {
      async identify(_data: unknown, _ctx?: unknown): Promise<IdentifyResult> {
        return baseResult;
      },
    };

    manager.registerWith(deviceManager);

    const result = await deviceManager.identify(
      {},
      { ip: '8.8.8.8', userId: 'u1' },
    ) as EnrichedIdentifyResult;

    expect(result.deviceId).toBe('dev_abc');
    expect(result.ipEnrichment).toBeDefined();
    expect(result.ipEnrichment?.country).toBe('US');
    expect(result.ipEnrichment?.asn).toBe(15169);
    expect(result.ipRiskDelta).toBeDefined();

    geoEnrich.mockRestore();
    proxyInit.mockRestore();
    proxyClassify.mockRestore();
  });

  it('passes through result unchanged when no ip in context', async () => {
    const manager = new IpManager({ enableReputation: false });

    const baseResult: IdentifyResult = {
      deviceId: 'dev_xyz', confidence: 70, isNewDevice: true, matchConfidence: 0,
    };

    const deviceManager = {
      async identify(_data?: unknown, _ctx?: unknown): Promise<IdentifyResult> { return baseResult; },
    };

    manager.registerWith(deviceManager);
    const result = await deviceManager.identify({}) as EnrichedIdentifyResult;

    expect(result.deviceId).toBe('dev_xyz');
    expect(result.ipEnrichment).toBeUndefined();
    expect(result.ipRiskDelta).toBeUndefined();
  });

  it('stores IP history per deviceId', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'DE', latitude: 52.5, longitude: 13.4 });

    vi.spyOn(
      (manager as unknown as { proxy: { init: () => unknown } }).proxy,
      'init',
    ).mockResolvedValue(undefined);

    vi.spyOn(
      (manager as unknown as { proxy: { classifyAll: () => unknown } }).proxy,
      'classifyAll',
    ).mockReturnValue({ isTor: false, isVpn: false, isProxy: false, isHosting: false });

    const deviceManager = {
      async identify(_data?: unknown, _ctx?: unknown): Promise<IdentifyResult> {
        return { deviceId: 'dev_hist', confidence: 95, isNewDevice: false, matchConfidence: 90 };
      },
    };
    manager.registerWith(deviceManager);

    await deviceManager.identify({}, { ip: '1.2.3.4' });
    await deviceManager.identify({}, { ip: '5.6.7.8' });

    const history = manager.getHistory('dev_hist');
    expect(history).toHaveLength(2);
  });
});
