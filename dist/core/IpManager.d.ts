import { type LicenseTier } from '../libs/license.js';
import type { IpManagerOptions, IpEnrichment, IpSnapshot, IdentifyResult } from '../types.js';
/**
 * Structural type for DeviceManager.identify so we avoid a hard dep on
 * devicer.js at runtime while keeping full type safety.
 */
interface DeviceManagerLike {
    identify(data: unknown, context?: Record<string, unknown>): Promise<IdentifyResult>;
}
export declare class IpManager {
    private readonly geo;
    private readonly proxy;
    private storage;
    private readonly options;
    /** Resolved license info — available after {@link init} completes. */
    private licenseInfo;
    private initPromise;
    constructor(opts?: IpManagerOptions);
    /** The active license tier. Resolves to `'free'` until {@link init} completes. */
    get tier(): LicenseTier;
    /**
     * Explicitly initialise enrichers (opens mmdb files, fetches Tor list) and
     * validates the Polar license key if one was supplied.
     *
     * Call this once at application startup before processing requests. Safe to
     * await multiple times — subsequent calls return the cached promise.
     */
    init(): Promise<void>;
    private _doInit;
    private ensureInit;
    /**
     * Enrich an IP address for a given deviceId.
     * Saves a snapshot and returns the enrichment + risk delta.
     *
     * Free-tier callers are limited to {@link FREE_TIER_MAX_DEVICES} unique
     * devices. When the cap is reached, snapshots for new device IDs are
     * silently dropped and a console warning is emitted.
     */
    enrich(ip: string, deviceId: string): Promise<{
        enrichment: IpEnrichment;
        riskDelta: number;
    }>;
    /**
     * Returns the full IP history for a deviceId.
     */
    getHistory(deviceId: string, limit?: number): IpSnapshot[];
    /**
     * Registers this IpManager with a DeviceManager instance by wrapping its
     * `identify` method. Any call to `deviceManager.identify(data, { ip, ... })`
     * will automatically enrich the result with IP signals.
     */
    registerWith(deviceManager: DeviceManagerLike): void;
    /** Close and release MaxMind file handles. */
    close(): void;
}
export {};
//# sourceMappingURL=IpManager.d.ts.map