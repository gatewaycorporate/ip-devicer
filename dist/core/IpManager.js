import { GeoEnricher } from '../libs/enrichment/GeoEnricher.js';
import { ProxyEnricher } from '../libs/enrichment/ProxyEnricher.js';
import { computeRiskScore } from '../libs/enrichment/reputation.js';
import { detectImpossibleTravel, computeRiskDelta, computeConsistencyScore, } from '../libs/scoring.js';
import { createIpStorage } from '../libs/adapters/inmemory.js';
import { validateLicense, FREE_TIER_MAX_DEVICES, FREE_TIER_MAX_HISTORY, } from '../libs/license.js';
const DEFAULT_IMPOSSIBLE_TRAVEL_KMH = 900;
const LICENSE_WARN = '[ip-devicer] No license key — running on the free tier ' +
    `(${FREE_TIER_MAX_HISTORY} history snapshots/device, ${FREE_TIER_MAX_DEVICES.toLocaleString()} device limit). ` +
    'Visit https://polar.sh to upgrade to Pro or Enterprise.';
const LICENSE_INVALID_WARN = '[ip-devicer] License key could not be validated — falling back to the free tier. ' +
    'Check your key or network connectivity.';
const DEVICE_LIMIT_WARN = `[ip-devicer] Free-tier device limit reached (${FREE_TIER_MAX_DEVICES.toLocaleString()} devices). ` +
    'New device will not be tracked. Upgrade to Pro or Enterprise to remove this limit.';
export class IpManager {
    geo;
    proxy;
    storage;
    options;
    /** Resolved license info — available after {@link init} completes. */
    licenseInfo = {
        valid: false,
        tier: 'free',
        maxDevices: FREE_TIER_MAX_DEVICES,
    };
    initPromise = null;
    constructor(opts = {}) {
        const hasKey = Boolean(opts.licenseKey?.trim());
        if (!hasKey) {
            console.warn(LICENSE_WARN);
        }
        // Optimistic history depth when a key is supplied — _doInit() will
        // downgrade to FREE_TIER_MAX_HISTORY if Polar rejects the key.
        const maxHistory = hasKey
            ? (opts.maxHistoryPerDevice ?? 50)
            : (opts.maxHistoryPerDevice ?? FREE_TIER_MAX_HISTORY);
        this.options = {
            ...opts,
            enableReputation: opts.enableReputation ?? true,
            impossibleTravelThresholdKmh: opts.impossibleTravelThresholdKmh ?? DEFAULT_IMPOSSIBLE_TRAVEL_KMH,
            maxHistoryPerDevice: maxHistory,
        };
        this.geo = new GeoEnricher(opts.maxmindPath, opts.asnPath);
        this.proxy = new ProxyEnricher(opts.torExitListUrl, opts.proxyListPaths ?? [], hasKey);
        this.storage = createIpStorage(maxHistory);
    }
    // ── Accessors ────────────────────────────────────────────
    /** The active license tier. Resolves to `'free'` until {@link init} completes. */
    get tier() {
        return this.licenseInfo.tier;
    }
    // ── Lifecycle ─────────────────────────────────────────────
    /**
     * Explicitly initialise enrichers (opens mmdb files, fetches Tor list) and
     * validates the Polar license key if one was supplied.
     *
     * Call this once at application startup before processing requests. Safe to
     * await multiple times — subsequent calls return the cached promise.
     */
    async init() {
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = this._doInit();
        return this.initPromise;
    }
    async _doInit() {
        const licenseKey = this.options.licenseKey?.trim();
        const [licenseInfo] = await Promise.all([
            licenseKey
                ? validateLicense(licenseKey)
                : Promise.resolve(this.licenseInfo),
            this.geo.init(),
            this.proxy.init(),
        ]);
        this.licenseInfo = licenseInfo;
        if (licenseKey && !licenseInfo.valid) {
            console.warn(LICENSE_INVALID_WARN);
            // If we over-provisioned history, recreate storage with free-tier cap.
            if (this.options.maxHistoryPerDevice > FREE_TIER_MAX_HISTORY) {
                this.storage = createIpStorage(FREE_TIER_MAX_HISTORY);
                this.options.maxHistoryPerDevice =
                    FREE_TIER_MAX_HISTORY;
            }
        }
    }
    async ensureInit() {
        if (this.initPromise === null)
            await this.init();
        else
            await this.initPromise;
    }
    /**
     * Enrich an IP address for a given deviceId.
     * Saves a snapshot and returns the enrichment + risk delta.
     *
     * Free-tier callers are limited to {@link FREE_TIER_MAX_DEVICES} unique
     * devices. When the cap is reached, snapshots for new device IDs are
     * silently dropped and a console warning is emitted.
     */
    async enrich(ip, deviceId) {
        await this.ensureInit();
        // ── Free-tier device cap ───────────────────────────────────
        const isKnown = this.storage.getLatest(deviceId) !== null;
        if (!isKnown &&
            this.licenseInfo.tier === 'free' &&
            this.storage.size() >= FREE_TIER_MAX_DEVICES) {
            console.warn(DEVICE_LIMIT_WARN);
            // Return a zero-signal enrichment so callers still get a result.
            const empty = {
                isProxy: false, isVpn: false, isTor: false, isHosting: false,
                riskScore: 0, riskFactors: [], consistencyScore: 0,
                impossibleTravel: false,
            };
            return { enrichment: empty, riskDelta: 0 };
        }
        const [geoData, classification] = await Promise.all([
            this.geo.enrich(ip),
            Promise.resolve(this.proxy.classifyAll(ip)),
        ]);
        const history = this.storage.getHistory(deviceId);
        // Impossible travel check
        let impossibleTravel = false;
        const latest = this.storage.getLatest(deviceId);
        if (latest &&
            geoData.latitude !== undefined &&
            geoData.longitude !== undefined &&
            latest.enrichment.latitude !== undefined &&
            latest.enrichment.longitude !== undefined) {
            impossibleTravel = detectImpossibleTravel({ lat: geoData.latitude, lon: geoData.longitude, ts: new Date() }, {
                lat: latest.enrichment.latitude,
                lon: latest.enrichment.longitude,
                ts: latest.timestamp,
            }, this.options.impossibleTravelThresholdKmh);
        }
        // Risk score
        const { score: riskScore, factors: riskFactors } = computeRiskScore({
            ...geoData,
            ...classification,
            impossibleTravel,
            deviceHistory: history,
        }, this.options.enableReputation);
        // Build partial enrichment for consistency score
        const partialEnrichment = {
            ...geoData,
            ...classification,
            impossibleTravel,
            riskScore,
            riskFactors,
        };
        const consistencyScore = computeConsistencyScore({ ...partialEnrichment, consistencyScore: 0 }, history);
        const enrichment = { ...partialEnrichment, consistencyScore };
        // Persist snapshot
        this.storage.save({
            deviceId,
            ip,
            timestamp: new Date(),
            enrichment,
        });
        const riskDelta = computeRiskDelta(enrichment, history);
        return { enrichment, riskDelta };
    }
    /**
     * Returns the full IP history for a deviceId.
     */
    getHistory(deviceId, limit) {
        return this.storage.getHistory(deviceId, limit);
    }
    /**
     * Registers this IpManager with a DeviceManager instance by wrapping its
     * `identify` method. Any call to `deviceManager.identify(data, { ip, ... })`
     * will automatically enrich the result with IP signals.
     */
    registerWith(deviceManager) {
        const original = deviceManager.identify.bind(deviceManager);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        deviceManager.identify = async function patchedIdentify(data, context) {
            const result = await original(data, context);
            const ctx = (context ?? {});
            if (!ctx.ip)
                return result;
            try {
                const { enrichment, riskDelta } = await self.enrich(ctx.ip, result.deviceId);
                return { ...result, ipEnrichment: enrichment, ipRiskDelta: riskDelta };
            }
            catch {
                // enrichment failure is non-fatal
                return result;
            }
        };
    }
    /** Close and release MaxMind file handles. */
    close() {
        this.geo.close();
    }
}
