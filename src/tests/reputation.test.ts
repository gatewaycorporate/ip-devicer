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

// ── rdapInfo integration ───────────────────────────────────────────────────────

describe('computeRiskScore – rdapInfo integration', () => {
  it('adds rdap_suspect_org for a known VPN registrant org', () => {
    const { score, factors } = computeRiskScore(
      { ...baseEnrichment, rdapInfo: { asnOrg: 'Mullvad VPN AB' } },
      true,
    );
    expect(factors).toContain('rdap_suspect_org');
    expect(score).toBe(10);
  });

  it('adds rdap_suspect_org for Tefincom (NordVPN registrant)', () => {
    const { score, factors } = computeRiskScore(
      { ...baseEnrichment, rdapInfo: { asnOrg: 'Tefincom S.A.' } },
      true,
    );
    expect(factors).toContain('rdap_suspect_org');
    expect(score).toBe(10);
  });

  it('adds rdap_suspect_org for Bright Data (proxy registrant)', () => {
    const { score, factors } = computeRiskScore(
      { ...baseEnrichment, rdapInfo: { asnOrg: 'Bright Data Ltd' } },
      true,
    );
    expect(factors).toContain('rdap_suspect_org');
    expect(score).toBe(10);
  });

  it('does not add rdap_suspect_org for a clean ISP', () => {
    const { factors } = computeRiskScore(
      { ...baseEnrichment, rdapInfo: { asnOrg: 'Comcast Cable Communications' } },
      true,
    );
    expect(factors).not.toContain('rdap_suspect_org');
  });

  it('does not add rdap_suspect_org when asnOrg is absent', () => {
    const { factors } = computeRiskScore(
      { ...baseEnrichment, rdapInfo: { asn: 12345 } },
      true,
    );
    expect(factors).not.toContain('rdap_suspect_org');
  });

  it('does not add rdap_suspect_org when rdapInfo is undefined', () => {
    const { factors } = computeRiskScore(
      { ...baseEnrichment },
      true,
    );
    expect(factors).not.toContain('rdap_suspect_org');
  });

  it('rdap_suspect_org is not scored when reputation is disabled', () => {
    const { score, factors } = computeRiskScore(
      { ...baseEnrichment, rdapInfo: { asnOrg: 'Mullvad VPN AB' } },
      false,
    );
    expect(score).toBe(0);
    expect(factors).toHaveLength(0);
  });

  it('uses rdapInfo.asn as fallback for new_asn when input.asn is undefined', () => {
    const history: IpSnapshot[] = [{
      id: '1', deviceId: 'd1', timestamp: new Date(), ip: '1.2.3.4',
      enrichment: { ...baseEnrichment, consistencyScore: 100, riskScore: 0, riskFactors: [], asn: 999, isTor: false, isVpn: false, isProxy: false, isHosting: false, impossibleTravel: false },
    }];
    const { factors } = computeRiskScore(
      { ...baseEnrichment, asn: undefined, rdapInfo: { asn: 15169 }, deviceHistory: history },
      true,
    );
    expect(factors).toContain('new_asn');
  });

  it('rdap_suspect_org stacks with other factors and caps at 100', () => {
    const { score } = computeRiskScore(
      {
        ...baseEnrichment,
        isTor: true, isVpn: true, isProxy: true, isHosting: true, impossibleTravel: true,
        rdapInfo: { asnOrg: 'Mullvad VPN AB' },
      },
      true,
    );
    expect(score).toBe(100);
  });
});
