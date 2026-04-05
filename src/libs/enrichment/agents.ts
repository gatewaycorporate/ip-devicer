/** Canonical provider identifiers used throughout the AI-agent IP catalog. */
export type AiAgentProvider =
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'google'
  | 'microsoft'
  | 'meta'
  | 'mistral'
  | 'cohere'
  | 'perplexity'
  | 'groq'
  | 'together'
  | 'huggingface'
  | 'fireworks'
  | 'writer'
  | 'deepseek';

/** Confidence tier assigned to an AI-agent range based on attribution quality. */
export type AiAgentConfidence =
  | 'verified'
  | 'rdap-attributed'
  | 'partner-attributed'
  | 'candidate';

/** Promotion state of a catalog entry within the shipped range sets. */
export type AiAgentRangeStatus = 'default' | 'extended' | 'candidate';

/** High-level traffic role the range is believed to represent. */
export type AiAgentTrafficType =
  | 'crawler'
  | 'user-triggered'
  | 'agent-runtime'
  | 'provider-infrastructure';

/** Evidence source used to justify a catalog entry. */
export type AiAgentEvidenceType =
  | 'published-feed'
  | 'rdap-sample'
  | 'domain-resolution';

/** Supporting evidence attached to a curated AI-agent CIDR entry. */
export interface AiAgentEvidence {
  /** Type of supporting evidence used to justify the attribution. */
  type: AiAgentEvidenceType;
  /** Feed URL, hostname, or other external reference backing the evidence. */
  reference: string;
  /** Example IP address observed for the provider, when applicable. */
  sampleIp?: string;
  /** RDAP organization string observed for the sampled IP. */
  rdapOrg?: string;
  /** Date the evidence was manually verified. */
  verifiedAt?: string;
  /** Additional human-readable notes about the evidence. */
  note?: string;
}

/** Provider metadata used for display names, aliases, and curation notes. */
export interface AiAgentProviderProfile {
  /** Stable provider identifier. */
  provider: AiAgentProvider;
  /** Human-readable provider name. */
  displayName: string;
  /** RDAP and hostname aliases associated with the provider. */
  aliases: readonly string[];
  /** Provider homepage or primary product page. */
  homepage: string;
  /** Notes about attribution quality or curation caveats. */
  notes: string;
}

/** Single curated CIDR entry representing AI-agent or provider infrastructure traffic. */
export interface AiAgentRange {
  /** Provider attributed to the CIDR. */
  provider: AiAgentProvider;
  /** Attribution confidence assigned during curation. */
  confidence: AiAgentConfidence;
  /** Whether the range ships by default, as an extended set, or as a candidate. */
  status: AiAgentRangeStatus;
  /** Label describing where the entry originated. */
  source: string;
  /** IPv4 CIDR block or exact `/32` sample address. */
  cidr: string;
  /** High-level traffic category for the entry. */
  trafficType: AiAgentTrafficType;
  /** Evidence supporting the attribution. */
  evidence: readonly AiAgentEvidence[];
  /** Optional curation notes about why the entry is included. */
  notes?: string;
}

const RDAP_VERIFIED_AT = '2026-03-13';

/** Provider metadata table for the shipped AI-agent catalog. */
export const AI_AGENT_PROVIDER_PROFILES: Record<AiAgentProvider, AiAgentProviderProfile> = {
  openai: {
    provider: 'openai',
    displayName: 'OpenAI',
    aliases: ['openai', 'open ai', 'chatgpt', 'gptbot'],
    homepage: 'https://openai.com',
    notes: 'Strongest source quality in the catalog because OpenAI publishes crawler and user-triggered bot feeds.',
  },
  anthropic: {
    provider: 'anthropic',
    displayName: 'Anthropic',
    aliases: ['anthropic', 'claude'],
    homepage: 'https://www.anthropic.com',
    notes: 'No public bot IP feed was found during implementation; current entries stay below default confidence.',
  },
  xai: {
    provider: 'xai',
    displayName: 'xAI',
    aliases: ['xai', 'x.ai', 'grok'],
    homepage: 'https://x.ai',
    notes: 'Current attribution is based on provider domains fronted by Cloudflare rather than a published bot feed.',
  },
  google: {
    provider: 'google',
    displayName: 'Google',
    aliases: ['google', 'gemini', 'google ai'],
    homepage: 'https://ai.google.dev',
    notes: 'Representative Gemini API domain resolved to Google-owned space in RDAP.',
  },
  microsoft: {
    provider: 'microsoft',
    displayName: 'Microsoft',
    aliases: ['microsoft', 'copilot', 'azure'],
    homepage: 'https://copilot.microsoft.com',
    notes: 'Representative Copilot domain resolved behind Cloudflare, so entries remain partner-attributed.',
  },
  meta: {
    provider: 'meta',
    displayName: 'Meta',
    aliases: ['meta', 'facebook', 'meta ai'],
    homepage: 'https://ai.meta.com',
    notes: 'Representative Meta AI domain resolved to Meta-owned space in RDAP.',
  },
  mistral: {
    provider: 'mistral',
    displayName: 'Mistral AI',
    aliases: ['mistral', 'mistral ai'],
    homepage: 'https://mistral.ai',
    notes: 'Representative API domain resolved behind Cloudflare, so entries remain partner-attributed.',
  },
  cohere: {
    provider: 'cohere',
    displayName: 'Cohere',
    aliases: ['cohere'],
    homepage: 'https://cohere.com',
    notes: 'Representative API domain resolved to Google-owned space, so attribution depends on provider domain plus hosting partner.',
  },
  perplexity: {
    provider: 'perplexity',
    displayName: 'Perplexity',
    aliases: ['perplexity'],
    homepage: 'https://www.perplexity.ai',
    notes: 'Representative API domain resolved behind Cloudflare, so entries remain partner-attributed.',
  },
  groq: {
    provider: 'groq',
    displayName: 'Groq',
    aliases: ['groq'],
    homepage: 'https://groq.com',
    notes: 'Representative API domain resolved behind Cloudflare, so entries remain partner-attributed.',
  },
  together: {
    provider: 'together',
    displayName: 'Together AI',
    aliases: ['together', 'together ai'],
    homepage: 'https://together.ai',
    notes: 'Representative API domain resolved behind Cloudflare, so entries remain partner-attributed.',
  },
  huggingface: {
    provider: 'huggingface',
    displayName: 'Hugging Face',
    aliases: ['hugging face', 'huggingface'],
    homepage: 'https://huggingface.co',
    notes: 'Representative inference endpoint resolved to Amazon CloudFront space, so attribution depends on provider domain plus hosting partner.',
  },
  fireworks: {
    provider: 'fireworks',
    displayName: 'Fireworks AI',
    aliases: ['fireworks', 'fireworks ai'],
    homepage: 'https://fireworks.ai',
    notes: 'Representative API domain resolved to Google Cloud space, so attribution depends on provider domain plus hosting partner.',
  },
  writer: {
    provider: 'writer',
    displayName: 'Writer',
    aliases: ['writer'],
    homepage: 'https://writer.com',
    notes: 'Representative API domain resolved to Google-owned space, so attribution depends on provider domain plus hosting partner.',
  },
  deepseek: {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    aliases: ['deepseek'],
    homepage: 'https://www.deepseek.com',
    notes: 'Representative API domain resolved to AWS CloudFront space, so entries remain partner-attributed.',
  },
};

/** Human-readable definitions for the supported AI-agent confidence tiers. */
export const AI_AGENT_CURATION_POLICY = [
  'verified: published provider-owned bot feed or equivalent public source',
  'rdap-attributed: representative provider domain resolves directly to provider-owned network space',
  'partner-attributed: representative provider domain resolves to a known CDN or cloud partner rather than provider-owned space',
  'candidate: domain ownership or RDAP match is too weak to promote above watchlist level',
] as const;

/** Verified AI-agent ranges backed by provider-published feeds or equivalent primary sources. */
export const VERIFIED_AI_AGENT_RANGES: AiAgentRange[] = [
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'OAI-SearchBot', cidr: '104.210.140.128/28', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/searchbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'OAI-SearchBot', cidr: '135.234.64.0/24', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/searchbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'OAI-SearchBot', cidr: '20.169.77.0/25', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/searchbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'OAI-SearchBot', cidr: '4.227.36.0/25', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/searchbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'OAI-SearchBot', cidr: '51.8.102.0/24', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/searchbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'OAI-SearchBot', cidr: '74.7.244.0/25', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/searchbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'GPTBot', cidr: '132.196.86.0/24', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/gptbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'GPTBot', cidr: '172.182.202.0/25', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/gptbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'GPTBot', cidr: '20.171.206.0/24', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/gptbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'GPTBot', cidr: '52.230.152.0/24', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/gptbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'GPTBot', cidr: '74.7.227.0/25', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/gptbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'GPTBot', cidr: '74.7.241.0/25', trafficType: 'crawler',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/gptbot.json', note: 'OpenAI published crawler feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'ChatGPT-User', cidr: '104.210.139.192/28', trafficType: 'user-triggered',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/chatgpt-user.json', note: 'OpenAI published user-triggered bot feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'ChatGPT-User', cidr: '13.65.138.96/28', trafficType: 'user-triggered',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/chatgpt-user.json', note: 'OpenAI published user-triggered bot feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'ChatGPT-User', cidr: '20.169.78.128/28', trafficType: 'user-triggered',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/chatgpt-user.json', note: 'OpenAI published user-triggered bot feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'ChatGPT-User', cidr: '40.116.73.208/28', trafficType: 'user-triggered',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/chatgpt-user.json', note: 'OpenAI published user-triggered bot feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'ChatGPT-User', cidr: '52.173.219.96/28', trafficType: 'user-triggered',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/chatgpt-user.json', note: 'OpenAI published user-triggered bot feed' }],
  },
  {
    provider: 'openai', confidence: 'verified', status: 'default', source: 'ChatGPT-User', cidr: '74.7.36.96/28', trafficType: 'user-triggered',
    evidence: [{ type: 'published-feed', reference: 'https://openai.com/chatgpt-user.json', note: 'OpenAI published user-triggered bot feed' }],
  },
];

/** Extended ranges attributed directly to provider-owned network space via RDAP review. */
export const RDAP_ATTRIBUTED_AI_AGENT_RANGES: AiAgentRange[] = [
  {
    provider: 'google', confidence: 'rdap-attributed', status: 'extended', source: 'Gemini API sample', cidr: '142.250.189.138/32', trafficType: 'provider-infrastructure',
    evidence: [{ type: 'rdap-sample', reference: 'generativelanguage.googleapis.com', sampleIp: '142.250.189.138', rdapOrg: 'GOOGLE', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Gemini API domain resolved directly to Google-owned space.',
  },
  {
    provider: 'meta', confidence: 'rdap-attributed', status: 'extended', source: 'Meta AI sample', cidr: '157.240.254.12/32', trafficType: 'provider-infrastructure',
    evidence: [{ type: 'rdap-sample', reference: 'ai.meta.com', sampleIp: '157.240.254.12', rdapOrg: 'THEFA-3', verifiedAt: RDAP_VERIFIED_AT, note: 'Meta/Facebook-owned addressing' }],
    notes: 'Representative Meta AI domain resolved directly to Meta-owned space.',
  },
];

/** Extended ranges attributed through a hosting or CDN partner rather than provider-owned space. */
export const PARTNER_ATTRIBUTED_AI_AGENT_RANGES: AiAgentRange[] = [
  {
    provider: 'xai', confidence: 'partner-attributed', status: 'extended', source: 'xAI API sample', cidr: '104.18.19.80/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.x.ai', sampleIp: '104.18.19.80', rdapOrg: 'CLOUDFLARENET', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Provider domain attribution is strong, but the resolved IP belongs to Cloudflare rather than xAI directly.',
  },
  {
    provider: 'microsoft', confidence: 'partner-attributed', status: 'extended', source: 'Copilot sample', cidr: '104.18.22.222/32', trafficType: 'provider-infrastructure',
    evidence: [{ type: 'rdap-sample', reference: 'copilot.microsoft.com', sampleIp: '104.18.22.222', rdapOrg: 'CLOUDFLARENET', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Copilot domain resolved behind Cloudflare.',
  },
  {
    provider: 'mistral', confidence: 'partner-attributed', status: 'extended', source: 'Mistral API sample', cidr: '104.18.22.152/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.mistral.ai', sampleIp: '104.18.22.152', rdapOrg: 'CLOUDFLARENET', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Mistral API domain resolved behind Cloudflare.',
  },
  {
    provider: 'cohere', confidence: 'partner-attributed', status: 'extended', source: 'Cohere API sample', cidr: '34.96.76.122/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.cohere.com', sampleIp: '34.96.76.122', rdapOrg: 'GOOGL-2', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Cohere API domain resolved to Google-hosted space rather than a Cohere-owned network block.',
  },
  {
    provider: 'perplexity', confidence: 'partner-attributed', status: 'extended', source: 'Perplexity API sample', cidr: '104.18.26.48/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.perplexity.ai', sampleIp: '104.18.26.48', rdapOrg: 'CLOUDFLARENET', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Perplexity API domain resolved behind Cloudflare.',
  },
  {
    provider: 'groq', confidence: 'partner-attributed', status: 'extended', source: 'Groq API sample', cidr: '172.64.149.20/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.groq.com', sampleIp: '172.64.149.20', rdapOrg: 'CLOUDFLARENET', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Groq API domain resolved behind Cloudflare.',
  },
  {
    provider: 'together', confidence: 'partner-attributed', status: 'extended', source: 'Together API sample', cidr: '172.64.144.98/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.together.xyz', sampleIp: '172.64.144.98', rdapOrg: 'CLOUDFLARENET', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Together API domain resolved behind Cloudflare.',
  },
  {
    provider: 'huggingface', confidence: 'partner-attributed', status: 'extended', source: 'Hugging Face inference sample', cidr: '18.160.181.69/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api-inference.huggingface.co', sampleIp: '18.160.181.69', rdapOrg: 'AMAZON-CF', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative inference endpoint resolved to Amazon CloudFront space.',
  },
  {
    provider: 'fireworks', confidence: 'partner-attributed', status: 'extended', source: 'Fireworks API sample', cidr: '35.209.59.6/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.fireworks.ai', sampleIp: '35.209.59.6', rdapOrg: 'GOOGLE-CLOUD', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Fireworks API domain resolved to Google Cloud space.',
  },
  {
    provider: 'writer', confidence: 'partner-attributed', status: 'extended', source: 'Writer API sample', cidr: '34.49.62.108/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.writer.com', sampleIp: '34.49.62.108', rdapOrg: 'GOOGL-2', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Writer API domain resolved to Google-hosted space.',
  },
  {
    provider: 'deepseek', confidence: 'partner-attributed', status: 'extended', source: 'DeepSeek API sample', cidr: '3.173.21.63/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.deepseek.com', sampleIp: '3.173.21.63', rdapOrg: 'AWS-CLOUDFRONT', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative DeepSeek API domain resolved to AWS CloudFront space.',
  },
];

/** Watchlist-only ranges that have weak attribution and should not ship by default. */
export const CANDIDATE_AI_AGENT_RANGES: AiAgentRange[] = [
  {
    provider: 'anthropic', confidence: 'candidate', status: 'candidate', source: 'Anthropic API sample', cidr: '160.79.104.10/32', trafficType: 'agent-runtime',
    evidence: [{ type: 'rdap-sample', reference: 'api.anthropic.com', sampleIp: '160.79.104.10', rdapOrg: 'AP-2440', verifiedAt: RDAP_VERIFIED_AT }],
    notes: 'Representative Anthropic API domain resolved to a non-obvious RDAP org string, so it remains watchlist-only until attribution is reviewed manually.',
  },
];

/**
 * Default ranges are intentionally conservative to avoid broad false positives
 * if this module is wired into runtime classification. Verified feed-backed
 * OpenAI ranges are included here; lower-confidence ranges remain in the
 * extended and candidate collections until explicitly promoted.
 */
export const DEFAULT_AI_AGENT_RANGES: AiAgentRange[] = [...VERIFIED_AI_AGENT_RANGES];

/** Union of all default, extended, and candidate AI-agent ranges. */
export const ALL_AI_AGENT_RANGES: AiAgentRange[] = [
  ...VERIFIED_AI_AGENT_RANGES,
  ...RDAP_ATTRIBUTED_AI_AGENT_RANGES,
  ...PARTNER_ATTRIBUTED_AI_AGENT_RANGES,
  ...CANDIDATE_AI_AGENT_RANGES,
];

/** RDAP/hostname aliases that help map observed registrant strings back to providers. */
export const AI_AGENT_PROVIDER_RDAP_ALIASES: Record<AiAgentProvider, string[]> = {
  openai: [...AI_AGENT_PROVIDER_PROFILES.openai.aliases],
  anthropic: [...AI_AGENT_PROVIDER_PROFILES.anthropic.aliases],
  xai: [...AI_AGENT_PROVIDER_PROFILES.xai.aliases],
  google: [...AI_AGENT_PROVIDER_PROFILES.google.aliases],
  microsoft: [...AI_AGENT_PROVIDER_PROFILES.microsoft.aliases],
  meta: [...AI_AGENT_PROVIDER_PROFILES.meta.aliases],
  mistral: [...AI_AGENT_PROVIDER_PROFILES.mistral.aliases],
  cohere: [...AI_AGENT_PROVIDER_PROFILES.cohere.aliases],
  perplexity: [...AI_AGENT_PROVIDER_PROFILES.perplexity.aliases],
  groq: [...AI_AGENT_PROVIDER_PROFILES.groq.aliases],
  together: [...AI_AGENT_PROVIDER_PROFILES.together.aliases],
  huggingface: [...AI_AGENT_PROVIDER_PROFILES.huggingface.aliases],
  fireworks: [...AI_AGENT_PROVIDER_PROFILES.fireworks.aliases],
  writer: [...AI_AGENT_PROVIDER_PROFILES.writer.aliases],
  deepseek: [...AI_AGENT_PROVIDER_PROFILES.deepseek.aliases],
};

/** Return all catalog entries assigned to a specific confidence tier. */
export function getAiAgentRangesByConfidence(confidence: AiAgentConfidence): AiAgentRange[] {
  return ALL_AI_AGENT_RANGES.filter((entry) => entry.confidence === confidence);
}

/** Return all catalog entries attributed to a single provider. */
export function getAiAgentRangesByProvider(provider: AiAgentProvider): AiAgentRange[] {
  return ALL_AI_AGENT_RANGES.filter((entry) => entry.provider === provider);
}

/** Group a range collection by provider using the full provider key set. */
export function groupAiAgentRangesByProvider(
  ranges: readonly AiAgentRange[] = ALL_AI_AGENT_RANGES,
): Record<AiAgentProvider, AiAgentRange[]> {
  return {
    openai: ranges.filter((entry) => entry.provider === 'openai'),
    anthropic: ranges.filter((entry) => entry.provider === 'anthropic'),
    xai: ranges.filter((entry) => entry.provider === 'xai'),
    google: ranges.filter((entry) => entry.provider === 'google'),
    microsoft: ranges.filter((entry) => entry.provider === 'microsoft'),
    meta: ranges.filter((entry) => entry.provider === 'meta'),
    mistral: ranges.filter((entry) => entry.provider === 'mistral'),
    cohere: ranges.filter((entry) => entry.provider === 'cohere'),
    perplexity: ranges.filter((entry) => entry.provider === 'perplexity'),
    groq: ranges.filter((entry) => entry.provider === 'groq'),
    together: ranges.filter((entry) => entry.provider === 'together'),
    huggingface: ranges.filter((entry) => entry.provider === 'huggingface'),
    fireworks: ranges.filter((entry) => entry.provider === 'fireworks'),
    writer: ranges.filter((entry) => entry.provider === 'writer'),
    deepseek: ranges.filter((entry) => entry.provider === 'deepseek'),
  };
}