import type { IpEnrichment, IpSnapshot } from '../../types.js';
interface ReputationInput extends Omit<IpEnrichment, 'riskScore' | 'riskFactors' | 'consistencyScore'> {
    deviceHistory: IpSnapshot[];
}
/**
 * Compute an IP risk score and the factors that contributed to it.
 *
 * The score is a capped weighted sum of network-type flags (Tor, VPN, proxy,
 * hosting), impossible-travel detection, AI-agent attribution, suspicious RDAP
 * registrants, and changes relative to the device's most recent country or ASN.
 *
 * @param input - Current enrichment signals plus recent device IP history.
 * @param enabled - When `false`, risk scoring is disabled and the function returns zero risk.
 * @returns Risk score in `[0, 100]` plus a list of factor identifiers that fired.
 */
export declare function computeRiskScore(input: ReputationInput, enabled: boolean): {
    score: number;
    factors: string[];
};
export {};
//# sourceMappingURL=reputation.d.ts.map