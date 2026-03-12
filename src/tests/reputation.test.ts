import { describe, it, expect } from 'vitest';
import { computeRiskScore } from '../libs/enrichment/reputation.js';
import type { IpSnapshot } from '../types.js';

const baseEnrichment = {
  isTor: false, isVpn: false, isProxy: false, isHosting: false,
  impossibleTravel: false, deviceHistory: [] as IpSnapshot[],
  country: 'US', city: 'New York', asn: 15169,
};

describe('computeRiskScore', () => {
  it('returns zero score when disabled', () => {
    const { score, factors } = computeRiskScore({ ...baseEnrichment, isTor: true }, false);
    expect(score).toBe(0);
    expect(factors).toHaveLength(0);
  });

  it('scores Tor exit node at 40', () => {
    const { score, factors } = computeRiskScore({ ...baseEnrichment, isTor: true }, true);
    expect(score).toBe(40);
    expect(factors).toContain('tor_exit_node');
  });

  it('scores VPN at 30', () => {
    const { score, factors } = computeRiskScore({ ...baseEnrichment, isVpn: true }, true);
    expect(score).toBe(30);
    expect(factors).toContain('vpn_detected');
  });

  it('scores proxy at 25', () => {
    const { score, factors } = computeRiskScore({ ...baseEnrichment, isProxy: true }, true);
    expect(score).toBe(25);
    expect(factors).toContain('proxy_detected');
  });

  it('scores hosting at 15', () => {
    const { score, factors } = computeRiskScore({ ...baseEnrichment, isHosting: true }, true);
    expect(score).toBe(15);
    expect(factors).toContain('hosting_ip');
  });

  it('scores impossible travel at 20', () => {
    const { score, factors } = computeRiskScore({ ...baseEnrichment, impossibleTravel: true }, true);
    expect(score).toBe(20);
    expect(factors).toContain('impossible_travel');
  });

  it('adds new_country when country differs from history', () => {
    const history: IpSnapshot[] = [{
      id: '1', deviceId: 'd1', timestamp: new Date(), ip: '1.2.3.4',
      enrichment: { ...baseEnrichment, consistencyScore: 100, riskScore: 0, riskFactors: [], country: 'GB', isTor: false, isVpn: false, isProxy: false, isHosting: false, impossibleTravel: false },
    }];
    const { score, factors } = computeRiskScore({ ...baseEnrichment, country: 'US', deviceHistory: history }, true);
    expect(factors).toContain('new_country');
    expect(score).toBe(10);
  });

  it('adds new_asn when ASN differs from history', () => {
    const history: IpSnapshot[] = [{
      id: '1', deviceId: 'd1', timestamp: new Date(), ip: '1.2.3.4',
      enrichment: { ...baseEnrichment, consistencyScore: 100, riskScore: 0, riskFactors: [], asn: 999, isTor: false, isVpn: false, isProxy: false, isHosting: false, impossibleTravel: false },
    }];
    const { score, factors } = computeRiskScore({ ...baseEnrichment, asn: 15169, deviceHistory: history }, true);
    expect(factors).toContain('new_asn');
  });

  it('caps at 100', () => {
    const { score } = computeRiskScore({
      ...baseEnrichment,
      isTor: true, isVpn: true, isProxy: true, isHosting: true, impossibleTravel: true,
    }, true);
    expect(score).toBe(100);
  });
});
