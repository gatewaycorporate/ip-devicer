import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reader } from '@maxmind/geoip2-node';
import { GeoEnricher } from '../libs/enrichment/GeoEnricher.js';

vi.mock('@maxmind/geoip2-node', () => ({
  Reader: {
    open: vi.fn(),
  },
}));

type CityLookup = {
  country?: { isoCode?: string; names?: { en?: string } };
  city?: { names?: { en?: string } };
  subdivisions?: Array<{ isoCode?: string }>;
  location?: { latitude?: number; longitude?: number; timeZone?: string };
};

type AsnLookup = {
  autonomousSystemNumber?: number;
  autonomousSystemOrganization?: string;
};

describe('GeoEnricher', () => {
  const openMock = vi.mocked(Reader.open);

  beforeEach(() => {
    openMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens configured city and ASN databases only once across repeated init calls', async () => {
    openMock
      .mockResolvedValueOnce({ city: vi.fn() } as never)
      .mockResolvedValueOnce({ asn: vi.fn() } as never);

    const enricher = new GeoEnricher('/tmp/city.mmdb', '/tmp/asn.mmdb');
    await Promise.all([enricher.init(), enricher.init()]);

    expect(openMock).toHaveBeenCalledTimes(2);
    expect(openMock).toHaveBeenNthCalledWith(1, '/tmp/city.mmdb');
    expect(openMock).toHaveBeenNthCalledWith(2, '/tmp/asn.mmdb');
  });

  it('lazily initializes and maps city fields', async () => {
    const cityResult: CityLookup = {
      country: { isoCode: 'US', names: { en: 'United States' } },
      city: { names: { en: 'Seattle' } },
      subdivisions: [{ isoCode: 'WA' }],
      location: { latitude: 47.6062, longitude: -122.3321, timeZone: 'America/Los_Angeles' },
    };
    const city = vi.fn().mockReturnValue(cityResult);
    openMock.mockResolvedValueOnce({ city } as never);

    const enricher = new GeoEnricher('/tmp/city.mmdb');

    await expect(enricher.enrichCity('203.0.113.10')).resolves.toEqual({
      country: 'US',
      countryName: 'United States',
      city: 'Seattle',
      subdivision: 'WA',
      latitude: 47.6062,
      longitude: -122.3321,
      timezone: 'America/Los_Angeles',
    });
    expect(city).toHaveBeenCalledWith('203.0.113.10');
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty city data when no city database is configured', async () => {
    const enricher = new GeoEnricher(undefined, '/tmp/asn.mmdb');
    openMock.mockResolvedValueOnce({ asn: vi.fn() } as never);

    await expect(enricher.enrichCity('203.0.113.10')).resolves.toEqual({});
  });

  it('returns empty city data when lookup throws', async () => {
    openMock.mockResolvedValueOnce({
      city: vi.fn().mockImplementation(() => {
        throw new Error('bad city lookup');
      }),
    } as never);

    const enricher = new GeoEnricher('/tmp/city.mmdb');
    await expect(enricher.enrichCity('203.0.113.10')).resolves.toEqual({});
  });

  it('maps ASN fields and handles missing ASN database', async () => {
    const asn = vi.fn().mockReturnValue({
      autonomousSystemNumber: 64512,
      autonomousSystemOrganization: 'Example Networks',
    } satisfies AsnLookup);
    openMock.mockResolvedValueOnce({ asn } as never);

    const enricher = new GeoEnricher(undefined, '/tmp/asn.mmdb');
    await expect(enricher.enrichAsn('198.51.100.5')).resolves.toEqual({
      asn: 64512,
      asnOrg: 'Example Networks',
    });

    const noAsnEnricher = new GeoEnricher('/tmp/city.mmdb');
    openMock.mockResolvedValueOnce({ city: vi.fn() } as never);
    await expect(noAsnEnricher.enrichAsn('198.51.100.5')).resolves.toEqual({});
  });

  it('returns empty ASN data when lookup throws', async () => {
    openMock.mockResolvedValueOnce({
      asn: vi.fn().mockImplementation(() => {
        throw new Error('bad asn lookup');
      }),
    } as never);

    const enricher = new GeoEnricher(undefined, '/tmp/asn.mmdb');
    await expect(enricher.enrichAsn('198.51.100.5')).resolves.toEqual({});
  });

  it('combines city and ASN enrichment and can be reinitialized after close', async () => {
    openMock
      .mockResolvedValueOnce({
        city: vi.fn().mockReturnValue({
          country: { isoCode: 'GB', names: { en: 'United Kingdom' } },
          city: { names: { en: 'London' } },
        } satisfies CityLookup),
      } as never)
      .mockResolvedValueOnce({
        asn: vi.fn().mockReturnValue({
          autonomousSystemNumber: 64513,
          autonomousSystemOrganization: 'Example ASN Org',
        } satisfies AsnLookup),
      } as never)
      .mockResolvedValueOnce({ city: vi.fn().mockReturnValue({}) } as never)
      .mockResolvedValueOnce({ asn: vi.fn().mockReturnValue({}) } as never);

    const enricher = new GeoEnricher('/tmp/city.mmdb', '/tmp/asn.mmdb');
    await expect(enricher.enrich('198.51.100.20')).resolves.toEqual({
      country: 'GB',
      countryName: 'United Kingdom',
      city: 'London',
      asn: 64513,
      asnOrg: 'Example ASN Org',
    });

    enricher.close();
    await enricher.init();

    expect(openMock).toHaveBeenCalledTimes(4);
  });
});