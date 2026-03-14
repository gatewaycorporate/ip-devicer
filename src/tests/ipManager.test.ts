import { describe, it, expect, vi } from 'vitest';
import { IpManager } from '../core/IpManager.js';
import type { IdentifyResult, EnrichedIdentifyResult } from '../types.js';

const emptyEnrichmentInfo = {
  plugins: [],
  details: {},
  failures: [],
};

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
      enrichmentInfo: emptyEnrichmentInfo,
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
      enrichmentInfo: emptyEnrichmentInfo,
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

  it('resolves the client IP from X-Real-IP headers when context.ip is omitted', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'GB', latitude: 51.5, longitude: -0.1 });

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
        return {
          deviceId: 'dev_real_ip',
          confidence: 80,
          isNewDevice: false,
          matchConfidence: 80,
          enrichmentInfo: emptyEnrichmentInfo,
        };
      },
    };

    manager.registerWith(deviceManager);

    const result = await deviceManager.identify({}, {
      headers: { 'x-real-ip': '198.51.100.7' },
    }) as EnrichedIdentifyResult;

    expect(result.ipEnrichment).toBeDefined();
    expect(manager.getHistory('dev_real_ip')).toHaveLength(1);
    expect(manager.getHistory('dev_real_ip')[0]?.ip).toBe('198.51.100.7');
  });

  it('prefers X-Real-IP over context.ip when both are present', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'GB', latitude: 51.5, longitude: -0.1 });

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
        return {
          deviceId: 'dev_real_ip_overrides_context',
          confidence: 80,
          isNewDevice: false,
          matchConfidence: 80,
          enrichmentInfo: emptyEnrichmentInfo,
        };
      },
    };

    manager.registerWith(deviceManager);

    await deviceManager.identify({}, {
      ip: '104.16.132.229',
      headers: { 'x-real-ip': '198.51.100.8' },
    });

    expect(manager.getHistory('dev_real_ip_overrides_context')[0]?.ip).toBe('198.51.100.8');
  });

  it('prefers X-Real-IP over X-Forwarded-For when deriving the client IP from headers', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'FR', latitude: 48.9, longitude: 2.3 });

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
        return {
          deviceId: 'dev_real_ip_preferred',
          confidence: 76,
          isNewDevice: false,
          matchConfidence: 76,
          enrichmentInfo: emptyEnrichmentInfo,
        };
      },
    };

    manager.registerWith(deviceManager);

    await deviceManager.identify({}, {
      headers: {
        'x-real-ip': '198.51.100.9',
        'x-forwarded-for': '203.0.113.5, 10.0.0.1',
      },
    });

    expect(manager.getHistory('dev_real_ip_preferred')[0]?.ip).toBe('198.51.100.9');
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
        return {
          deviceId: 'dev_hist',
          confidence: 95,
          isNewDevice: false,
          matchConfidence: 90,
          enrichmentInfo: emptyEnrichmentInfo,
        };
      },
    };
    manager.registerWith(deviceManager);

    await deviceManager.identify({}, { ip: '1.2.3.4' });
    await deviceManager.identify({}, { ip: '5.6.7.8' });

    const history = manager.getHistory('dev_hist');
    expect(history).toHaveLength(2);
  });

  it('registers a DeviceManager post-processor when the hook API is available', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'CA', latitude: 43.7, longitude: -79.4, asn: 64512 });

    vi.spyOn(
      (manager as unknown as { proxy: { init: () => unknown } }).proxy,
      'init',
    ).mockResolvedValue(undefined);

    vi.spyOn(
      (manager as unknown as { proxy: { classifyAll: () => unknown } }).proxy,
      'classifyAll',
    ).mockReturnValue({ isTor: false, isVpn: true, isProxy: false, isHosting: false });

    let registeredProcessor:
      | ((payload: { result: IdentifyResult; context?: Record<string, unknown> }) => Promise<{ result?: Record<string, unknown>; enrichmentInfo?: Record<string, unknown>; logMeta?: Record<string, unknown> } | void> | { result?: Record<string, unknown>; enrichmentInfo?: Record<string, unknown>; logMeta?: Record<string, unknown> } | void)
      | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook',
        confidence: 88,
        isNewDevice: false,
        matchConfidence: 88,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((name: string, processor: typeof registeredProcessor) => {
        expect(name).toBe('ip');
        registeredProcessor = processor;
        return () => {};
      }),
    };

    manager.registerWith(deviceManager);

    const outcome = await registeredProcessor!({
      result: {
        deviceId: 'dev_hook',
        confidence: 88,
        isNewDevice: false,
        matchConfidence: 88,
        enrichmentInfo: emptyEnrichmentInfo,
      },
      context: { ip: '8.8.4.4' },
    });

    expect(deviceManager.registerIdentifyPostProcessor).toHaveBeenCalledTimes(1);
    expect(outcome?.result?.ipEnrichment).toBeDefined();
    expect(outcome?.enrichmentInfo).toMatchObject({ country: 'CA', isVpn: true });
    expect(outcome?.logMeta).toMatchObject({ riskDelta: expect.any(Number) });
  });

  it('uses X-Real-IP in post-processor mode when context.ip is omitted', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'AU', latitude: -33.9, longitude: 151.2 });

    vi.spyOn(
      (manager as unknown as { proxy: { init: () => unknown } }).proxy,
      'init',
    ).mockResolvedValue(undefined);

    vi.spyOn(
      (manager as unknown as { proxy: { classifyAll: () => unknown } }).proxy,
      'classifyAll',
    ).mockReturnValue({ isTor: false, isVpn: false, isProxy: false, isHosting: false });

    let registeredProcessor:
      | ((payload: { result: IdentifyResult; context?: Record<string, unknown> }) => Promise<{ result?: Record<string, unknown>; enrichmentInfo?: Record<string, unknown>; logMeta?: Record<string, unknown> } | void> | { result?: Record<string, unknown>; enrichmentInfo?: Record<string, unknown>; logMeta?: Record<string, unknown> } | void)
      | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook_real_ip',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((_: string, processor: typeof registeredProcessor) => {
        registeredProcessor = processor;
        return () => {};
      }),
    };

    manager.registerWith(deviceManager);

    const outcome = await registeredProcessor!({
      result: {
        deviceId: 'dev_hook_real_ip',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      },
      context: {
        headers: { 'x-real-ip': '203.0.113.45' },
      },
    });

    expect(outcome?.result?.ipEnrichment).toBeDefined();
    expect(manager.getHistory('dev_hook_real_ip')[0]?.ip).toBe('203.0.113.45');
  });

  it('prefers X-Real-IP over context.ip in post-processor mode', async () => {
    const manager = new IpManager({ enableReputation: false });

    vi.spyOn(
      (manager as unknown as { geo: { enrich: () => unknown } }).geo,
      'enrich',
    ).mockResolvedValue({ country: 'AU', latitude: -33.9, longitude: 151.2 });

    vi.spyOn(
      (manager as unknown as { proxy: { init: () => unknown } }).proxy,
      'init',
    ).mockResolvedValue(undefined);

    vi.spyOn(
      (manager as unknown as { proxy: { classifyAll: () => unknown } }).proxy,
      'classifyAll',
    ).mockReturnValue({ isTor: false, isVpn: false, isProxy: false, isHosting: false });

    let registeredProcessor:
      | ((payload: { result: IdentifyResult; context?: Record<string, unknown> }) => Promise<{ result?: Record<string, unknown>; enrichmentInfo?: Record<string, unknown>; logMeta?: Record<string, unknown> } | void> | { result?: Record<string, unknown>; enrichmentInfo?: Record<string, unknown>; logMeta?: Record<string, unknown> } | void)
      | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook_real_ip_overrides_context',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((_: string, processor: typeof registeredProcessor) => {
        registeredProcessor = processor;
        return () => {};
      }),
    };

    manager.registerWith(deviceManager);

    await registeredProcessor!({
      result: {
        deviceId: 'dev_hook_real_ip_overrides_context',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      },
      context: {
        ip: '104.16.132.229',
        headers: { 'x-real-ip': '203.0.113.46' },
      },
    });

    expect(manager.getHistory('dev_hook_real_ip_overrides_context')[0]?.ip).toBe('203.0.113.46');
  });
});
