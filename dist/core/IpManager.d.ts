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
    private readonly storage;
    private readonly options;
    private readonly hasLicense;
    private initPromise;
    constructor(opts?: IpManagerOptions);
    /** Explicitly initialise enrichers (opens mmdb files, fetches Tor list). */
    init(): Promise<void>;
    private ensureInit;
    /**
     * Enrich an IP address for a given deviceId.
     * Saves a snapshot and returns the enrichment + risk delta.
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