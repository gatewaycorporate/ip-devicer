# ip-devicer

## Developed by Gateway Corporate Solutions

**IP Intelligence Middleware** for the FP-Devicer Intelligence Suite.

Instantly enrich every `deviceId` with production-grade IP signals: MaxMind
geolocation (country, city, subdivision, ASN), proxy/VPN/Tor/hosting detection,
reputation scoring, impossible-travel alerts, and historical consistency
matching — all 100% self-hosted and invisible to clients.

Part of the [FP-Devicer](https://github.com/gatewaycorporate/fp-devicer) family
— invisible to clients and extremely hard to spoof.

## Usage

ip-devicer is designed to integrate seamlessly with FP-Devicer by use of the
`registerWith` helper.

```typescript
import { IpManager } from "ip-devicer";

const deviceManager = new DeviceManager(createInMemoryAdapter());
const ipManager = new IpManager({
	licenseKey: process.env.IP_DEVICER_LICENSE_KEY,
	maxmindPath: "./data/GeoLite2-City.mmdb",
	asnPath: "./data/GeoLite2-ASN.mmdb",
	enableReputation: true,
});

// One-line registration — everything else is automatic
ipManager.registerWith(deviceManager);

app.post("/identify", async (req, res) => {
	const result = await deviceManager.identify(req.body.fpPayload, {
		ip: req.ip,
		userId: req.user?.id,
		headers: req.headers,
	});

	console.log("IP Enrichment Result:", {
		deviceId: result.deviceId,
		confidence: result.confidence,
		ipRiskDelta: result.ipRiskDelta,
		enrichment: result.ipEnrichment,
	});

	res.json(result);
});
```

## Recommended Setup (MaxMind)

To get full usage out of this library, you will need to follow these
instructions:

1. Create a free MaxMind account at maxmind.com
2. Generate a license key in the portal
3. Download the latest:
   - GeoLite2-City.mmdb
   - GeoLite2-ASN.mmdb
4. Place them in ./data/ (or any secure path) and add to .gitignore

## License

Published under the **Business Source License 1.1 (BSL-1.1)**

- Free for dev/testing/personal use
- Production use requires a paid license from Polar.sh
- Free tier has device count limits and basic features only

Pass the key in the constructor to remove all restrictions.

## Obtaining a Key

ip-devicer uses polar.js for key verification. You can obtain a key for dual use
of this library and tls-devicer by
