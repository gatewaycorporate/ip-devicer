#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

function parseArgs(argv) {
  const args = { input: '', provider: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--input') args.input = argv[index + 1] ?? '';
    if (token === '--provider') args.provider = argv[index + 1] ?? '';
  }
  return args;
}

function usage() {
  console.error('Usage: node ./scripts/verify-ai-agent-ranges.mjs --provider <name> --input <cidr-file>');
}

function ipToNumber(ip) {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + Number.parseInt(octet, 10)) >>> 0, 0) >>> 0;
}

function representativeIp(cidr) {
  const [base, prefixText] = cidr.split('/');
  const prefix = Number.parseInt(prefixText ?? '32', 10);
  if (!base || Number.isNaN(prefix) || base.includes(':') || prefix >= 31) return base ?? '';
  const sample = (ipToNumber(base) + 1) >>> 0;
  return [
    (sample >>> 24) & 255,
    (sample >>> 16) & 255,
    (sample >>> 8) & 255,
    sample & 255,
  ].join('.');
}

async function fetchRdap(ip) {
  for (const base of [
    'https://rdap.arin.net/registry/ip/',
    'https://rdap.db.ripe.net/ip/',
    'https://rdap.apnic.net/ip/',
  ]) {
    try {
      const response = await fetch(base + encodeURIComponent(ip), {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        if (response.status === 404) continue;
        return { registry: base, ok: false, status: response.status };
      }
      const data = await response.json();
      return {
        registry: base,
        ok: true,
        org: typeof data.name === 'string' ? data.name : '',
        asn: Array.isArray(data.originASes) && data.originASes[0] ? data.originASes[0] : '',
      };
    } catch {
      continue;
    }
  }

  return { registry: 'none', ok: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    usage();
    process.exit(2);
  }

  const content = await readFile(args.input, 'utf8');
  const cidrs = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const report = [];
  for (const cidr of cidrs) {
    const sampleIp = representativeIp(cidr);
    report.push({
      provider: args.provider || undefined,
      cidr,
      sampleIp,
      rdap: await fetchRdap(sampleIp),
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

await main();