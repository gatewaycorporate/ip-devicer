import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  detectImpossibleTravel,
  computeRiskDelta,
  computeConsistencyScore,
} from '../libs/scoring.js';
import type { IpEnrichment, IpSnapshot } from '../types.js';

// ── haversine ──────────────────────────────────────────────────

describe('haversineKm', () => {
  it('is zero for identical coords', () => {
    expect(haversineKm(40.71, -74.0, 40.71, -74.0)).toBe(0);
  });

  it('is ~5570 km NYC → London', () => {
    // NYC: 40.71, -74.00  |  London: 51.51, -0.13
    const dist = haversineKm(40.71, -74.0, 51.51, -0.13);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5700);
  });
});

// ── detectImpossibleTravel ─────────────────────────────────────

describe('detectImpossibleTravel', () => {
  it('flags NYC → London in 1 hour (~5600 km/h > 900)', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const oneHourAgo = new Date('2026-01-01T11:00:00Z');
    expect(
      detectImpossibleTravel(
        { lat: 51.51, lon: -0.13, ts: now },
        { lat: 40.71, lon: -74.0, ts: oneHourAgo },
        900,
      ),
    ).toBe(true);
  });

  it('does not flag same city over 2 hours', () => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    const t1 = new Date('2026-01-01T12:00:00Z');
    expect(
      detectImpossibleTravel(
        { lat: 40.72, lon: -74.01, ts: t1 },
        { lat: 40.71, lon: -74.0, ts: t0 },
        900,
      ),
    ).toBe(false);
  });

  it('does not flag Boston → NYC in 3 hours (~340 km / 3h ≈ 113 km/h)', () => {
    const t0 = new Date('2026-01-01T09:00:00Z');
    const t1 = new Date('2026-01-01T12:00:00Z');
    expect(
      detectImpossibleTravel(
        { lat: 40.71, lon: -74.0, ts: t1 },   // NYC
        { lat: 42.36, lon: -71.05, ts: t0 },  // Boston
        900,
      ),
    ).toBe(false);
  });
});

// ── computeRiskDelta ───────────────────────────────────────────

const makeEnrichment = (riskScore: number): IpEnrichment => ({
  isTor: false, isVpn: false, isProxy: false, isHosting: false,
  impossibleTravel: false, riskScore, riskFactors: [], consistencyScore: 100,
});

const makeSnapshot = (riskScore: number): IpSnapshot => ({
  id: '1', deviceId: 'd1', timestamp: new Date(), ip: '1.1.1.1',
  enrichment: makeEnrichment(riskScore),
});

describe('computeRiskDelta', () => {
  it('returns 0 with no history', () => {
    expect(computeRiskDelta(makeEnrichment(40), [])).toBe(0);
  });

  it('returns positive delta when current is riskier', () => {
    const history = [makeSnapshot(10), makeSnapshot(20)]; // avg 15
    expect(computeRiskDelta(makeEnrichment(45), history)).toBe(30);
  });

  it('returns negative delta when current is safer', () => {
    const history = [makeSnapshot(50), makeSnapshot(50)]; // avg 50
    expect(computeRiskDelta(makeEnrichment(10), history)).toBe(-40);
  });
});

// ── computeConsistencyScore ────────────────────────────────────

describe('computeConsistencyScore', () => {
  const base = makeEnrichment(0);

  it('returns 100 with no history', () => {
    expect(computeConsistencyScore(base, [])).toBe(100);
  });

  it('returns 100 when everything matches', () => {
    const current: IpEnrichment = {
      ...base, country: 'US', asn: 15169, city: 'New York',
    };
    const history: IpSnapshot[] = [{
      id: '1', deviceId: 'd1', timestamp: new Date(), ip: '8.8.8.8',
      enrichment: { ...current, consistencyScore: 100 },
    }];
    expect(computeConsistencyScore(current, history)).toBe(100);
  });

  it('loses country points when country differs', () => {
    const current: IpEnrichment = { ...base, country: 'DE', asn: 15169, city: 'Berlin' };
    const history: IpSnapshot[] = [{
      id: '1', deviceId: 'd1', timestamp: new Date(), ip: '8.8.8.8',
      enrichment: { ...base, country: 'US', asn: 15169, city: 'Berlin', consistencyScore: 100 },
    }];
    const score = computeConsistencyScore(current, history);
    expect(score).toBeLessThan(100);
    expect(score).toBe(60); // asn(30) + city(20) + flags(10) = 60
  });
});
