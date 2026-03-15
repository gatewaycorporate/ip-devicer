import { describe, it, expect, vi } from 'vitest';
import { IpManager } from '../core/IpManager.js';
import type { IdentifyResult, EnrichedIdentifyResult } from '../types.js';
import type { IdentifyPostProcessor } from 'devicer.js';

const emptyEnrichmentInfo = {
  plugins: [],
  details: {},
  failures: [],
};

const emptyClassification = {
  isTor: false,
  isVpn: false,
  isProxy: false,
  isHosting: false,
  agentInfo: { isAiAgent: false },
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
    ).mockReturnValue({
      ...emptyClassification,
      agentInfo: { isAiAgent: true, aiAgentProvider: 'openai', aiAgentConfidence: 100 },
    });

    const baseResult: IdentifyResult = {
      deviceId: 'dev_abc', confidence: 90, isNewDevice: false, matchConfidence: 85,
      enrichmentInfo: emptyEnrichmentInfo,
    };

    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };

    manager.registerWith(deviceManager);

    const outcome = await storedProcessor!({ result: baseResult, context: { ip: '8.8.8.8', userId: 'u1' } } as unknown as Parameters<IdentifyPostProcessor>[0]);
    const result = { ...baseResult, ...outcome?.result } as EnrichedIdentifyResult;

    expect(result.deviceId).toBe('dev_abc');
    expect(result.ipEnrichment).toBeDefined();
    expect(result.ipEnrichment?.country).toBe('US');
    expect(result.ipEnrichment?.asn).toBe(15169);
    expect(result.ipEnrichment?.agentInfo).toEqual({
      isAiAgent: true,
      aiAgentProvider: 'openai',
      aiAgentConfidence: 100,
    });
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
      registerIdentifyPostProcessor(_name: string, _fn: IdentifyPostProcessor) { return () => {}; },
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
    ).mockReturnValue(emptyClassification);

    const baseResult: IdentifyResult = {
      deviceId: 'dev_real_ip',
      confidence: 80,
      isNewDevice: false,
      matchConfidence: 80,
      enrichmentInfo: emptyEnrichmentInfo,
    };
    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };

    manager.registerWith(deviceManager);

    const outcome = await storedProcessor!({ result: baseResult, context: { headers: { 'x-real-ip': '198.51.100.7' } } } as unknown as Parameters<IdentifyPostProcessor>[0]);
    const result = { ...baseResult, ...outcome?.result } as EnrichedIdentifyResult;

    expect(result.ipEnrichment).toBeDefined();
    expect(await manager.getHistory('dev_real_ip')).toHaveLength(1);
    expect((await manager.getHistory('dev_real_ip'))[0]?.ip).toBe('198.51.100.7');
  });

  it('prefers CF-Connecting-IP over proxy-populated context.ip', async () => {
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
    ).mockReturnValue(emptyClassification);

    const baseResult: IdentifyResult = {
      deviceId: 'dev_cf_connecting_ip',
      confidence: 80,
      isNewDevice: false,
      matchConfidence: 80,
      enrichmentInfo: emptyEnrichmentInfo,
    };
    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };

    manager.registerWith(deviceManager);

    await storedProcessor!({ result: baseResult, context: { ip: '104.16.132.229', headers: { 'cf-connecting-ip': '198.51.100.10' } } } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect((await manager.getHistory('dev_cf_connecting_ip'))[0]?.ip).toBe('198.51.100.10');
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
    ).mockReturnValue(emptyClassification);

    const baseResult: IdentifyResult = {
      deviceId: 'dev_real_ip_overrides_context',
      confidence: 80,
      isNewDevice: false,
      matchConfidence: 80,
      enrichmentInfo: emptyEnrichmentInfo,
    };
    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };

    manager.registerWith(deviceManager);

    await storedProcessor!({ result: baseResult, context: { ip: '104.16.132.229', headers: { 'x-real-ip': '198.51.100.8' } } } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect((await manager.getHistory('dev_real_ip_overrides_context'))[0]?.ip).toBe('198.51.100.8');
  });

  it('prefers True-Client-IP over X-Real-IP when both are present', async () => {
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
    ).mockReturnValue(emptyClassification);

    const baseResult: IdentifyResult = {
      deviceId: 'dev_true_client_ip',
      confidence: 80,
      isNewDevice: false,
      matchConfidence: 80,
      enrichmentInfo: emptyEnrichmentInfo,
    };
    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };

    manager.registerWith(deviceManager);

    await storedProcessor!({ result: baseResult, context: { headers: { 'true-client-ip': '198.51.100.11', 'x-real-ip': '198.51.100.12' } } } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect((await manager.getHistory('dev_true_client_ip'))[0]?.ip).toBe('198.51.100.11');
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
    ).mockReturnValue(emptyClassification);

    const baseResult: IdentifyResult = {
      deviceId: 'dev_real_ip_preferred',
      confidence: 76,
      isNewDevice: false,
      matchConfidence: 76,
      enrichmentInfo: emptyEnrichmentInfo,
    };
    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };

    manager.registerWith(deviceManager);

    await storedProcessor!({ result: baseResult, context: { headers: { 'x-real-ip': '198.51.100.9', 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } } } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect((await manager.getHistory('dev_real_ip_preferred'))[0]?.ip).toBe('198.51.100.9');
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
    ).mockReturnValue(emptyClassification);

    const baseResult: IdentifyResult = {
      deviceId: 'dev_hist',
      confidence: 95,
      isNewDevice: false,
      matchConfidence: 90,
      enrichmentInfo: emptyEnrichmentInfo,
    };
    let storedProcessor: IdentifyPostProcessor | undefined;
    const deviceManager = {
      registerIdentifyPostProcessor(_name: string, fn: IdentifyPostProcessor) {
        storedProcessor = fn;
        return () => {};
      },
    };
    manager.registerWith(deviceManager);

    await storedProcessor!({ result: baseResult, context: { ip: '1.2.3.4' } } as unknown as Parameters<IdentifyPostProcessor>[0]);
    await storedProcessor!({ result: baseResult, context: { ip: '5.6.7.8' } } as unknown as Parameters<IdentifyPostProcessor>[0]);

    const history = await manager.getHistory('dev_hist');
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
    ).mockReturnValue({
      ...emptyClassification,
      isVpn: true,
      agentInfo: { isAiAgent: true, aiAgentProvider: 'openai', aiAgentConfidence: 100 },
    });

    let registeredProcessor: IdentifyPostProcessor | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook',
        confidence: 88,
        isNewDevice: false,
        matchConfidence: 88,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((name: string, processor: IdentifyPostProcessor) => {
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
    } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect(deviceManager.registerIdentifyPostProcessor).toHaveBeenCalledTimes(1);
    expect(outcome?.result?.ipEnrichment).toBeDefined();
    expect(outcome?.enrichmentInfo).toMatchObject({
      country: 'CA',
      isVpn: true,
      agentInfo: { isAiAgent: true, aiAgentProvider: 'openai', aiAgentConfidence: 100 },
    });
    expect(outcome?.logMeta).toMatchObject({
      riskDelta: expect.any(Number),
      networkFlags: {
        isVpn: true,
        agentInfo: { isAiAgent: true, aiAgentProvider: 'openai', aiAgentConfidence: 100 },
      },
    });
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
    ).mockReturnValue(emptyClassification);

    let registeredProcessor: IdentifyPostProcessor | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook_real_ip',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((_: string, processor: IdentifyPostProcessor) => {
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
    } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect(outcome?.result?.ipEnrichment).toBeDefined();
    expect((await manager.getHistory('dev_hook_real_ip'))[0]?.ip).toBe('203.0.113.45');
  });

  it('prefers CF-Connecting-IP in post-processor mode', async () => {
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
    ).mockReturnValue(emptyClassification);

    let registeredProcessor: IdentifyPostProcessor | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook_cf_connecting_ip',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((_: string, processor: IdentifyPostProcessor) => {
        registeredProcessor = processor;
        return () => {};
      }),
    };

    manager.registerWith(deviceManager);

    await registeredProcessor!({
      result: {
        deviceId: 'dev_hook_cf_connecting_ip',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      },
      context: {
        ip: '104.16.132.229',
        headers: { 'cf-connecting-ip': '203.0.113.47' },
      },
    } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect((await manager.getHistory('dev_hook_cf_connecting_ip'))[0]?.ip).toBe('203.0.113.47');
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
    ).mockReturnValue(emptyClassification);

    let registeredProcessor: IdentifyPostProcessor | undefined;

    const deviceManager = {
      identify: vi.fn(async (): Promise<IdentifyResult> => ({
        deviceId: 'dev_hook_real_ip_overrides_context',
        confidence: 82,
        isNewDevice: false,
        matchConfidence: 82,
        enrichmentInfo: emptyEnrichmentInfo,
      })),
      registerIdentifyPostProcessor: vi.fn((_: string, processor: IdentifyPostProcessor) => {
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
    } as unknown as Parameters<IdentifyPostProcessor>[0]);

    expect((await manager.getHistory('dev_hook_real_ip_overrides_context'))[0]?.ip).toBe('203.0.113.46');
  });
});
