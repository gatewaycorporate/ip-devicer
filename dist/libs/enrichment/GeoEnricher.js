import { Reader } from '@maxmind/geoip2-node';
/**
 * MaxMind-backed geolocation and ASN enricher for IP addresses.
 *
 * The enricher lazily opens the configured City and ASN mmdb files on first use.
 * Missing databases and lookup failures degrade to empty partial results rather
 * than throwing, which keeps enrichment non-fatal during request processing.
 */
export class GeoEnricher {
    cityDbPath;
    asnDbPath;
    cityReader = null;
    asnReader = null;
    initPromise = null;
    /**
     * @param cityDbPath - Path to a GeoLite2/GeoIP2 City mmdb file.
     * @param asnDbPath - Path to a GeoLite2/GeoIP2 ASN mmdb file.
     */
    constructor(cityDbPath, asnDbPath) {
        this.cityDbPath = cityDbPath;
        this.asnDbPath = asnDbPath;
    }
    /**
     * Open the configured MaxMind databases once.
     *
     * Safe to call multiple times; subsequent calls reuse the cached promise.
     */
    async init() {
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = (async () => {
            if (this.cityDbPath) {
                this.cityReader = await Reader.open(this.cityDbPath);
            }
            if (this.asnDbPath) {
                this.asnReader = await Reader.open(this.asnDbPath);
            }
        })();
        return this.initPromise;
    }
    async ensureInit() {
        if (this.initPromise === null)
            await this.init();
        else
            await this.initPromise;
    }
    /**
     * Resolve city-level geolocation data for an IP address.
     *
     * Returns an empty object when the city database is unavailable or the lookup fails.
     */
    async enrichCity(ip) {
        await this.ensureInit();
        if (!this.cityReader)
            return {};
        try {
            const result = this.cityReader.city(ip);
            return {
                country: result.country?.isoCode,
                countryName: result.country?.names?.en,
                city: result.city?.names?.en,
                subdivision: result.subdivisions?.[0]?.isoCode,
                latitude: result.location?.latitude,
                longitude: result.location?.longitude,
                timezone: result.location?.timeZone,
            };
        }
        catch {
            return {};
        }
    }
    /**
     * Resolve ASN metadata for an IP address.
     *
     * Returns an empty object when the ASN database is unavailable or the lookup fails.
     */
    async enrichAsn(ip) {
        await this.ensureInit();
        if (!this.asnReader)
            return {};
        try {
            const result = this.asnReader.asn(ip);
            return {
                asn: result.autonomousSystemNumber,
                asnOrg: result.autonomousSystemOrganization,
            };
        }
        catch {
            return {};
        }
    }
    /**
     * Resolve the combined geolocation and ASN enrichment for an IP address.
     *
     * City and ASN lookups run in parallel and their partial results are merged.
     */
    async enrich(ip) {
        const [city, asn] = await Promise.all([
            this.enrichCity(ip),
            this.enrichAsn(ip),
        ]);
        return { ...city, ...asn };
    }
    /** Reset the cached readers so the mmdb files can be reopened on the next lookup. */
    close() {
        // maxmind reader has no explicit close — GC handles it
        this.cityReader = null;
        this.asnReader = null;
        this.initPromise = null;
    }
}
