import { describe, expect, it } from 'vitest';
import {
  ALL_AI_AGENT_RANGES,
  AI_AGENT_CURATION_POLICY,
  AI_AGENT_PROVIDER_PROFILES,
  CANDIDATE_AI_AGENT_RANGES,
  DEFAULT_AI_AGENT_RANGES,
  PARTNER_ATTRIBUTED_AI_AGENT_RANGES,
  RDAP_ATTRIBUTED_AI_AGENT_RANGES,
  VERIFIED_AI_AGENT_RANGES,
  getAiAgentRangesByConfidence,
  getAiAgentRangesByProvider,
  groupAiAgentRangesByProvider,
} from '../libs/enrichment/agents.js';

describe('AI agent range catalog', () => {
  it('keeps default ranges conservative', () => {
    expect(DEFAULT_AI_AGENT_RANGES).toEqual(VERIFIED_AI_AGENT_RANGES);
    expect(DEFAULT_AI_AGENT_RANGES.every((entry) => entry.confidence === 'verified')).toBe(true);
  });

  it('contains multiple confidence tiers', () => {
    expect(getAiAgentRangesByConfidence('verified').length).toBeGreaterThan(0);
    expect(getAiAgentRangesByConfidence('rdap-attributed').length).toBeGreaterThan(0);
    expect(getAiAgentRangesByConfidence('partner-attributed').length).toBeGreaterThan(0);
    expect(getAiAgentRangesByConfidence('candidate').length).toBeGreaterThan(0);
  });

  it('includes a broad provider set', () => {
    expect(Object.keys(AI_AGENT_PROVIDER_PROFILES).length).toBeGreaterThanOrEqual(12);
    expect(getAiAgentRangesByProvider('openai').length).toBeGreaterThan(0);
    expect(getAiAgentRangesByProvider('google').length).toBeGreaterThan(0);
    expect(getAiAgentRangesByProvider('anthropic').length).toBeGreaterThan(0);
  });

  it('groups ranges by provider without dropping entries', () => {
    const grouped = groupAiAgentRangesByProvider();
    const flattened = Object.values(grouped).flat();
    expect(flattened).toHaveLength(ALL_AI_AGENT_RANGES.length);
  });

  it('pins the attribution tiers to their expected providers', () => {
    expect(RDAP_ATTRIBUTED_AI_AGENT_RANGES.map((entry) => entry.provider).sort()).toEqual(['google', 'meta']);
    expect(PARTNER_ATTRIBUTED_AI_AGENT_RANGES.length).toBeGreaterThan(5);
    expect(CANDIDATE_AI_AGENT_RANGES.map((entry) => entry.provider)).toEqual(['anthropic']);
  });

  it('documents curation policy', () => {
    expect(AI_AGENT_CURATION_POLICY.length).toBeGreaterThanOrEqual(4);
  });
});