/** Canonical provider identifiers used throughout the AI-agent IP catalog. */
export type AiAgentProvider = 'openai' | 'anthropic' | 'xai' | 'google' | 'microsoft' | 'meta' | 'mistral' | 'cohere' | 'perplexity' | 'groq' | 'together' | 'huggingface' | 'fireworks' | 'writer' | 'deepseek';
/** Confidence tier assigned to an AI-agent range based on attribution quality. */
export type AiAgentConfidence = 'verified' | 'rdap-attributed' | 'partner-attributed' | 'candidate';
/** Promotion state of a catalog entry within the shipped range sets. */
export type AiAgentRangeStatus = 'default' | 'extended' | 'candidate';
/** High-level traffic role the range is believed to represent. */
export type AiAgentTrafficType = 'crawler' | 'user-triggered' | 'agent-runtime' | 'provider-infrastructure';
/** Evidence source used to justify a catalog entry. */
export type AiAgentEvidenceType = 'published-feed' | 'rdap-sample' | 'domain-resolution';
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
/** Provider metadata table for the shipped AI-agent catalog. */
export declare const AI_AGENT_PROVIDER_PROFILES: Record<AiAgentProvider, AiAgentProviderProfile>;
/** Human-readable definitions for the supported AI-agent confidence tiers. */
export declare const AI_AGENT_CURATION_POLICY: readonly ["verified: published provider-owned bot feed or equivalent public source", "rdap-attributed: representative provider domain resolves directly to provider-owned network space", "partner-attributed: representative provider domain resolves to a known CDN or cloud partner rather than provider-owned space", "candidate: domain ownership or RDAP match is too weak to promote above watchlist level"];
/** Verified AI-agent ranges backed by provider-published feeds or equivalent primary sources. */
export declare const VERIFIED_AI_AGENT_RANGES: AiAgentRange[];
/** Extended ranges attributed directly to provider-owned network space via RDAP review. */
export declare const RDAP_ATTRIBUTED_AI_AGENT_RANGES: AiAgentRange[];
/** Extended ranges attributed through a hosting or CDN partner rather than provider-owned space. */
export declare const PARTNER_ATTRIBUTED_AI_AGENT_RANGES: AiAgentRange[];
/** Watchlist-only ranges that have weak attribution and should not ship by default. */
export declare const CANDIDATE_AI_AGENT_RANGES: AiAgentRange[];
/**
 * Default ranges are intentionally conservative to avoid broad false positives
 * if this module is wired into runtime classification. Verified feed-backed
 * OpenAI ranges are included here; lower-confidence ranges remain in the
 * extended and candidate collections until explicitly promoted.
 */
export declare const DEFAULT_AI_AGENT_RANGES: AiAgentRange[];
/** Union of all default, extended, and candidate AI-agent ranges. */
export declare const ALL_AI_AGENT_RANGES: AiAgentRange[];
/** RDAP/hostname aliases that help map observed registrant strings back to providers. */
export declare const AI_AGENT_PROVIDER_RDAP_ALIASES: Record<AiAgentProvider, string[]>;
/** Return all catalog entries assigned to a specific confidence tier. */
export declare function getAiAgentRangesByConfidence(confidence: AiAgentConfidence): AiAgentRange[];
/** Return all catalog entries attributed to a single provider. */
export declare function getAiAgentRangesByProvider(provider: AiAgentProvider): AiAgentRange[];
/** Group a range collection by provider using the full provider key set. */
export declare function groupAiAgentRangesByProvider(ranges?: readonly AiAgentRange[]): Record<AiAgentProvider, AiAgentRange[]>;
//# sourceMappingURL=agents.d.ts.map