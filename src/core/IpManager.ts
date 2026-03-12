import { GeoEnricher } from '../libs/enrichment/GeoEnricher.js';
import { ProxyEnricher } from '../libs/enrichment/ProxyEnricher.js';
import { computeRiskScore } from '../libs/enrichment/reputation.js';
import {
  detectImpossibleTravel,
  computeRiskDelta,
  computeConsistencyScore,
} from '../libs/scoring.js';
import { createIpStorage, type IpStorage } from '../libs/adapters/inmemory.js';
import type {
  IpManagerOptions,
  IpEnrichment,
  IpSnapshot,
  IpIdentifyContext,
  EnrichedIdentifyResult,
  IdentifyResult,
} from '../types.js';

const DEFAULT_IMPOSSIBLE_TRAVEL_KMH = 900;
const FREE_TIER_MAX_HISTORY = 10;
const LICENSE_WARN =
  '[ip-devicer] No license key — VPN/proxy detection and extended history disabled.';

/**
 * Structural type for DeviceManager.identify so we avoid a hard dep on
 * devicer.js at runtime while keeping full type safety.
 */
interface DeviceManagerLike {
  identify(
    data: unknown,
    context?: Record<string, unknown>,
  ): Promise<IdentifyResult>;
}

export class IpManager {
  private readonly geo: GeoEnricher;
  private readonly proxy: ProxyEnricher;
  private readonly storage: IpStorage;
  private readonly options: Required<
    Pick<
      IpManagerOptions,
      | 'enableReputation'
      | 'impossibleTravelThresholdKmh'
      | 'maxHistoryPerDevice'
    >
  > & IpManagerOptions;
  private readonly hasLicense: boolean;
  private initPromise: Promise<void> | null = null;

  constructor(opts: IpManagerOptions = {}) {
    this.hasLicense = Boolean(opts.licenseKey?.trim());

    if (!this.hasLicense) {
      console.warn(LICENSE_WARN);
    }

    const maxHistory = this.hasLicense
      ? (opts.maxHistoryPerDevice ?? 50)
      : FREE_TIER_MAX_HISTORY;

    this.options = {
      ...opts,
      enableReputation: opts.enableReputation ?? true,
      impossibleTravelThresholdKmh:
        opts.impossibleTravelThresholdKmh ?? DEFAULT_IMPOSSIBLE_TRAVEL_KMH,
      maxHistoryPerDevice: maxHistory,
    };

    this.geo = new GeoEnricher(opts.maxmindPath, opts.asnPath);
    this.proxy = new ProxyEnricher(
      opts.torExitListUrl,
      opts.proxyListPaths ?? [],
      this.hasLicense,
    );
    this.storage = createIpStorage(maxHistory);
  }

  /** Explicitly initialise enrichers (opens mmdb files, fetches Tor list). */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = Promise.all([
      this.geo.init(),
      this.proxy.init(),
    ]).then(() => undefined);
    return this.initPromise;
  }

  private async ensureInit(): Promise<void> {
    if (this.initPromise === null) await this.init();
    else await this.initPromise;
  }

  /**
   * Enrich an IP address for a given deviceId.
   * Saves a snapshot and returns the enrichment + risk delta.
   */
  async enrich(
    ip: string,
    deviceId: string,
  ): Promise<{ enrichment: IpEnrichment; riskDelta: number }> {
    await this.ensureInit();

    const [geoData, classification] = await Promise.all([
      this.geo.enrich(ip),
      Promise.resolve(this.proxy.classifyAll(ip)),
    ]);

    const history = this.storage.getHistory(deviceId);

    // Impossible travel check
    let impossibleTravel = false;
    const latest = this.storage.getLatest(deviceId);
    if (
      latest &&
      geoData.latitude !== undefined &&
      geoData.longitude !== undefined &&
      latest.enrichment.latitude !== undefined &&
      latest.enrichment.longitude !== undefined
    ) {
      impossibleTravel = detectImpossibleTravel(
        { lat: geoData.latitude, lon: geoData.longitude, ts: new Date() },
        {
          lat: latest.enrichment.latitude,
          lon: latest.enrichment.longitude,
          ts: latest.timestamp,
        },
        this.options.impossibleTravelThresholdKmh,
      );
    }

    // Risk score
    const { score: riskScore, factors: riskFactors } = computeRiskScore(
      {
        ...geoData,
        ...classification,
        impossibleTravel,
        deviceHistory: history,
      },
      this.options.enableReputation,
    );

    // Build partial enrichment for consistency score
    const partialEnrichment: Omit<IpEnrichment, 'consistencyScore'> = {
      ...geoData,
      ...classification,
      impossibleTravel,
      riskScore,
      riskFactors,
    };

    const consistencyScore = computeConsistencyScore(
      { ...partialEnrichment, consistencyScore: 0 } satisfies IpEnrichment,
      history,
    );

    const enrichment: IpEnrichment = { ...partialEnrichment, consistencyScore };

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
  getHistory(deviceId: string, limit?: number): IpSnapshot[] {
    return this.storage.getHistory(deviceId, limit);
  }

  /**
   * Registers this IpManager with a DeviceManager instance by wrapping its
   * `identify` method. Any call to `deviceManager.identify(data, { ip, ... })`
   * will automatically enrich the result with IP signals.
   */
  registerWith(deviceManager: DeviceManagerLike): void {
    const original = deviceManager.identify.bind(deviceManager);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    deviceManager.identify = async function patchedIdentify(
      data: unknown,
      context?: Record<string, unknown>,
    ): Promise<EnrichedIdentifyResult> {
      const result = await original(data, context);
      const ctx = (context ?? {}) as IpIdentifyContext;

      if (!ctx.ip) return result;

      try {
        const { enrichment, riskDelta } = await self.enrich(
          ctx.ip,
          result.deviceId,
        );
        return { ...result, ipEnrichment: enrichment, ipRiskDelta: riskDelta };
      } catch {
        // enrichment failure is non-fatal
        return result;
      }
    };
  }

  /** Close and release MaxMind file handles. */
  close(): void {
    this.geo.close();
  }
}
