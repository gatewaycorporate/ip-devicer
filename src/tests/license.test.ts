// ────────────────────────────────────────────────────────────
//  Tests — Polar license validation (ip-devicer)
// ────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateLicense,
  evictLicenseCache,
  POLAR_BENEFIT_IDS,
  FREE_TIER_MAX_DEVICES,
  FREE_TIER_MAX_HISTORY,
  type LicenseInfo,
} from '../libs/license.js';
import { IpManager } from '../core/IpManager.js';

// ── Helpers ────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

function mockFetchNetworkError(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
}

function polarGranted(benefitId: string) {
  return { status: 'granted', benefit_id: benefitId };
}

const KEY_PRO        = 'PRO-TEST-KEY-1111';
const KEY_ENTERPRISE = 'ENT-TEST-KEY-2222';
const KEY_UNKNOWN    = 'UNK-TEST-KEY-3333';
const KEY_INVALID    = 'BAD-TEST-KEY-4444';

// ── validateLicense ────────────────────────────────────────

describe('validateLicense', () => {
  beforeEach(() => {
    // Always start from a clean cache so tests are independent
    evictLicenseCache(KEY_PRO);
    evictLicenseCache(KEY_ENTERPRISE);
    evictLicenseCache(KEY_UNKNOWN);
    evictLicenseCache(KEY_INVALID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves to free tier when Polar returns non-ok HTTP status', async () => {
    mockFetch(null, 401);
    const info = await validateLicense(KEY_INVALID);
    expect(info.valid).toBe(false);
    expect(info.tier).toBe('free');
    expect(info.maxDevices).toBe(FREE_TIER_MAX_DEVICES);
  });

  it('resolves to free tier when Polar status !== granted', async () => {
    mockFetch({ status: 'revoked', benefit_id: POLAR_BENEFIT_IDS.pro });
    const info = await validateLicense(KEY_INVALID);
    expect(info.valid).toBe(false);
    expect(info.tier).toBe('free');
  });

  it('resolves to free tier on network error without throwing', async () => {
    mockFetchNetworkError();
    await expect(validateLicense(KEY_INVALID)).resolves.toMatchObject({
      valid: false,
      tier: 'free',
      maxDevices: FREE_TIER_MAX_DEVICES,
    });
  });

  it('resolves to pro tier when benefit_id matches POLAR_BENEFIT_IDS.pro', async () => {
    mockFetch(polarGranted(POLAR_BENEFIT_IDS.pro));
    const info = await validateLicense(KEY_PRO);
    expect(info.valid).toBe(true);
    expect(info.tier).toBe('pro');
    expect(info.maxDevices).toBeUndefined();
  });

  it('resolves to enterprise tier when benefit_id matches POLAR_BENEFIT_IDS.enterprise', async () => {
    mockFetch(polarGranted(POLAR_BENEFIT_IDS.enterprise));
    const info = await validateLicense(KEY_ENTERPRISE);
    expect(info.valid).toBe(true);
    expect(info.tier).toBe('enterprise');
    expect(info.maxDevices).toBeUndefined();
  });

  it('defaults to free when benefit_id is granted but does not match any known tier', async () => {
    mockFetch({ status: 'granted', benefit_id: 'unknown-benefit-xxxx' });
    const info = await validateLicense(KEY_UNKNOWN);
    expect(info.valid).toBe(false);
    expect(info.tier).toBe('free');
  });

  it('returns cached result on second call without re-fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => polarGranted(POLAR_BENEFIT_IDS.pro),
    });
    vi.stubGlobal('fetch', fetchMock);

    await validateLicense(KEY_PRO);
    await validateLicense(KEY_PRO);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after evictLicenseCache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => polarGranted(POLAR_BENEFIT_IDS.enterprise),
    });
    vi.stubGlobal('fetch', fetchMock);

    await validateLicense(KEY_ENTERPRISE);
    evictLicenseCache(KEY_ENTERPRISE);
    await validateLicense(KEY_ENTERPRISE);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('trims whitespace from the key before caching and sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => polarGranted(POLAR_BENEFIT_IDS.pro),
    });
    vi.stubGlobal('fetch', fetchMock);

    const info1 = await validateLicense('  ' + KEY_PRO + '  ');
    const info2 = await validateLicense(KEY_PRO); // should hit cache

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(info1.tier).toBe('pro');
    expect(info2.tier).toBe('pro');
  });
});

// ── IpManager — tier getter ────────────────────────────────

describe('IpManager tier getter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    evictLicenseCache(KEY_PRO);
    evictLicenseCache(KEY_ENTERPRISE);
    evictLicenseCache(KEY_INVALID);
  });

  it('returns free before init() is called (no key)', () => {
    const mgr = new IpManager();
    expect(mgr.tier).toBe('free');
  });

  it('returns free before init() even with a key supplied', () => {
    const mgr = new IpManager({ licenseKey: KEY_PRO });
    expect(mgr.tier).toBe('free');
  });

  it('returns pro after init() when Polar confirms a pro key', async () => {
    mockFetch(polarGranted(POLAR_BENEFIT_IDS.pro));
    const mgr = new IpManager({ licenseKey: KEY_PRO });
    mockGeoAndProxy(mgr);
    await mgr.init();
    expect(mgr.tier).toBe('pro');
  });

  it('returns enterprise after init() when Polar confirms an enterprise key', async () => {
    mockFetch(polarGranted(POLAR_BENEFIT_IDS.enterprise));
    const mgr = new IpManager({ licenseKey: KEY_ENTERPRISE });
    mockGeoAndProxy(mgr);
    await mgr.init();
    expect(mgr.tier).toBe('enterprise');
  });

  it('falls back to free after init() when Polar rejects the key', async () => {
    mockFetch(null, 403);
    const mgr = new IpManager({ licenseKey: KEY_INVALID });
    mockGeoAndProxy(mgr);
    await mgr.init();
    expect(mgr.tier).toBe('free');
  });

  it('falls back to free after init() on network error', async () => {
    mockFetchNetworkError();
    const mgr = new IpManager({ licenseKey: KEY_INVALID });
    mockGeoAndProxy(mgr);
    await mgr.init();
    expect(mgr.tier).toBe('free');
  });
});

// ── IpManager — history cap on key rejection ───────────────

describe('IpManager history downgrade', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    evictLicenseCache(KEY_INVALID);
  });

  it('caps maxHistoryPerDevice at FREE_TIER_MAX_HISTORY when key is rejected', async () => {
    mockFetch(null, 403);
    const mgr = new IpManager({ licenseKey: KEY_INVALID, maxHistoryPerDevice: 50 });
    mockGeoAndProxy(mgr);
    await mgr.init();
    // Push 12 snapshots — should be capped at FREE_TIER_MAX_HISTORY (10)
    for (let i = 0; i < 12; i++) {
      await mgr.enrich(`10.0.0.${i}`, 'dev-downgrade');
    }
    expect(mgr.getHistory('dev-downgrade').length).toBe(FREE_TIER_MAX_HISTORY);
  });

  it('retains full history when key is accepted', async () => {
    mockFetch(polarGranted(POLAR_BENEFIT_IDS.pro));
    const mgr = new IpManager({ licenseKey: KEY_PRO, maxHistoryPerDevice: 20 });
    mockGeoAndProxy(mgr);
    await mgr.init();
    for (let i = 0; i < 15; i++) {
      await mgr.enrich(`192.168.1.${i}`, 'dev-pro');
    }
    expect(mgr.getHistory('dev-pro').length).toBe(15);
  });
});

// ── IpManager — free-tier device cap ──────────────────────

describe('IpManager free-tier device limit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows enrichment for known device even when device cap is reached', async () => {
    const mgr = new IpManager({ enableReputation: false });
    mockGeoAndProxy(mgr);

    // Seed one snapshot for the device
    await mgr.enrich('1.2.3.4', 'known-dev');

    // Fake the storage reporting FREE_TIER_MAX_DEVICES unique devices
    const storage = (mgr as unknown as { storage: { size: () => number } }).storage;
    vi.spyOn(storage, 'size').mockReturnValue(FREE_TIER_MAX_DEVICES);

    // Known device — should still enrich
    const { enrichment } = await mgr.enrich('1.2.3.5', 'known-dev');
    expect(enrichment.country).toBe('US');
  });

  it('blocks enrichment for a new device when cap is reached and returns zero signal', async () => {
    const mgr = new IpManager({ enableReputation: false });
    mockGeoAndProxy(mgr);

    // Fake the storage reporting FREE_TIER_MAX_DEVICES unique devices
    const storage = (mgr as unknown as { storage: { size: () => number } }).storage;
    vi.spyOn(storage, 'size').mockReturnValue(FREE_TIER_MAX_DEVICES);

    const { enrichment, riskDelta } = await mgr.enrich('2.2.2.2', 'brand-new-dev');
    expect(enrichment.riskScore).toBe(0);
    expect(enrichment.riskFactors).toHaveLength(0);
    expect(riskDelta).toBe(0);
  });
});

// ── Shared helper ──────────────────────────────────────────

function mockGeoAndProxy(mgr: IpManager): void {
  vi.spyOn(
    (mgr as unknown as { geo: { init: () => unknown; enrich: () => unknown } }).geo,
    'init',
  ).mockResolvedValue(undefined);

  vi.spyOn(
    (mgr as unknown as { geo: { enrich: () => unknown } }).geo,
    'enrich',
  ).mockResolvedValue({
    country: 'US', countryName: 'United States', city: 'Reston',
    latitude: 38.9, longitude: -77.4, asn: 20473, asnOrg: 'Choopa LLC',
  });

  vi.spyOn(
    (mgr as unknown as { proxy: { init: () => unknown } }).proxy,
    'init',
  ).mockResolvedValue(undefined);

  vi.spyOn(
    (mgr as unknown as { proxy: { classifyAll: () => unknown } }).proxy,
    'classifyAll',
  ).mockReturnValue({
    isTor: false,
    isVpn: false,
    isProxy: false,
    isHosting: false,
    agentInfo: { isAiAgent: false },
  });
}
