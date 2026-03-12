import type { IpEnrichment, IpSnapshot } from '../../types.js';

interface ReputationInput extends Omit<IpEnrichment, 'riskScore' | 'riskFactors' | 'consistencyScore'> {
  deviceHistory: IpSnapshot[];
}

const WEIGHTS = {
  tor: 40,
  vpn: 30,
  proxy: 25,
  hosting: 15,
  impossibleTravel: 20,
  newCountry: 10,
  newAsn: 5,
} as const;

export function computeRiskScore(
  input: ReputationInput,
  enabled: boolean,
): { score: number; factors: string[] } {
  if (!enabled) return { score: 0, factors: [] };

  let score = 0;
  const factors: string[] = [];

  if (input.isTor) { score += WEIGHTS.tor; factors.push('tor_exit_node'); }
  if (input.isVpn) { score += WEIGHTS.vpn; factors.push('vpn_detected'); }
  if (input.isProxy) { score += WEIGHTS.proxy; factors.push('proxy_detected'); }
  if (input.isHosting) { score += WEIGHTS.hosting; factors.push('hosting_ip'); }
  if (input.impossibleTravel) { score += WEIGHTS.impossibleTravel; factors.push('impossible_travel'); }

  if (input.deviceHistory.length > 0) {
    const lastCountry = input.deviceHistory[0]?.enrichment?.country;
    if (lastCountry && input.country && lastCountry !== input.country) {
      score += WEIGHTS.newCountry;
      factors.push('new_country');
    }

    const lastAsn = input.deviceHistory[0]?.enrichment?.asn;
    if (lastAsn !== undefined && input.asn !== undefined && lastAsn !== input.asn) {
      score += WEIGHTS.newAsn;
      factors.push('new_asn');
    }
  }

  return { score: Math.min(score, 100), factors };
}
