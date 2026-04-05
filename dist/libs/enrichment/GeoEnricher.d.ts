import type { GeoData } from '../../types.js';
/**
 * MaxMind-backed geolocation and ASN enricher for IP addresses.
 *
 * The enricher lazily opens the configured City and ASN mmdb files on first use.
 * Missing databases and lookup failures degrade to empty partial results rather
 * than throwing, which keeps enrichment non-fatal during request processing.
 */
export declare class GeoEnricher {
    private readonly cityDbPath?;
    private readonly asnDbPath?;
    private cityReader;
    private asnReader;
    private initPromise;
    /**
     * @param cityDbPath - Path to a GeoLite2/GeoIP2 City mmdb file.
     * @param asnDbPath - Path to a GeoLite2/GeoIP2 ASN mmdb file.
     */
    constructor(cityDbPath?: string | undefined, asnDbPath?: string | undefined);
    /**
     * Open the configured MaxMind databases once.
     *
     * Safe to call multiple times; subsequent calls reuse the cached promise.
     */
    init(): Promise<void>;
    private ensureInit;
    /**
     * Resolve city-level geolocation data for an IP address.
     *
     * Returns an empty object when the city database is unavailable or the lookup fails.
     */
    enrichCity(ip: string): Promise<Partial<GeoData>>;
    /**
     * Resolve ASN metadata for an IP address.
     *
     * Returns an empty object when the ASN database is unavailable or the lookup fails.
     */
    enrichAsn(ip: string): Promise<{
        asn?: number;
        asnOrg?: string;
    }>;
    /**
     * Resolve the combined geolocation and ASN enrichment for an IP address.
     *
     * City and ASN lookups run in parallel and their partial results are merged.
     */
    enrich(ip: string): Promise<GeoData>;
    /** Reset the cached readers so the mmdb files can be reopened on the next lookup. */
    close(): void;
}
//# sourceMappingURL=GeoEnricher.d.ts.map