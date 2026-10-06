import type { NetworkEvidence } from '@botbad/contracts';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

const KNOWN_BOT_DEFINITIONS: BotDefinition[] = [
  {
    botIdentity: 'googlebot',
    userAgentPattern: /googlebot/i,
    validPtrSuffixes: ['.googlebot.com', '.google.com'],
    sourceId: 'google-bot-verification',
    sourceVersion: '2026-10-01',
    verificationMethod: 'dns-reverse-forward',
  },
  {
    botIdentity: 'bingbot',
    userAgentPattern: /bingbot/i,
    validPtrSuffixes: ['.search.msn.com'],
    sourceId: 'bing-bot-verification',
    sourceVersion: '2026-10-01',
    verificationMethod: 'dns-reverse-forward',
  },
  {
    botIdentity: 'facebookexternalhit',
    userAgentPattern: /facebookexternalhit|facebot/i,
    validPtrSuffixes: ['.facebook.com', '.fbcdn.net'],
    sourceId: 'meta-bot-verification',
    sourceVersion: '2026-10-01',
    verificationMethod: 'dns-reverse-forward',
  },
  {
    botIdentity: 'twitterbot',
    userAgentPattern: /twitterbot/i,
    validPtrSuffixes: ['.twitter.com', '.x.com'],
    sourceId: 'x-bot-verification',
    sourceVersion: '2026-10-01',
    verificationMethod: 'dns-reverse-forward',
  },
];

interface BotDefinition {
  botIdentity: string;
  userAgentPattern: RegExp;
  validPtrSuffixes: string[];
  sourceId: string;
  sourceVersion: string;
  verificationMethod: string;
}

const KNOWN_ASN_ORGS: Array<{ asn: number; organization: string }> = [
  { asn: 15169, organization: 'Google LLC' },
  { asn: 36492, organization: 'Google LLC' },
  { asn: 32934, organization: 'Facebook, Inc.' },
  { asn: 63293, organization: 'Facebook, Inc.' },
  { asn: 13414, organization: 'Twitter Inc.' },
  { asn: 396986, organization: 'ByteDance Ltd.' },
  { asn: 138699, organization: 'ByteDance Ltd.' },
  { asn: 8075, organization: 'Microsoft Corporation' },
  { asn: 16509, organization: 'Amazon.com, Inc.' },
  { asn: 14618, organization: 'Amazon.com, Inc.' },
];

const ASN_SOURCE_ID = 'local-asn-db';
const ASN_SOURCE_VERSION = '2026-10-01';
const ASN_VALIDITY_DAYS = 7;

const DNS_TIMEOUT_MS = 3000;

export function extractClientIp(
  peerIp: string,
  headers: Record<string, string | undefined>,
  trustedProxies: string[] = [],
): string {
  const normalizedPeer = normalizeIp(peerIp);

  if (trustedProxies.length > 0 && trustedProxies.includes(normalizedPeer)) {
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const firstIp = forwarded.split(',')[0]?.trim();
      if (firstIp && isIP(firstIp)) {
        return normalizeIp(firstIp);
      }
    }
  }

  return normalizedPeer;
}

export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();

  if (trimmed.startsWith('::ffff:') && isIP(trimmed.slice(7)) === 4) {
    return trimmed.slice(7);
  }

  if (isIP(trimmed) === 6) {
    return expandAndCompressIpv6(trimmed);
  }

  return trimmed;
}

function expandAndCompressIpv6(ip: string): string {
  const parts = ip.split(':');
  const expanded: string[] = [];
  for (const part of parts) {
    if (part === '') {
      const missing = 8 - parts.filter((p) => p !== '').length;
      for (let i = 0; i < missing + 1; i++) expanded.push('0000');
    } else {
      expanded.push(part.padStart(4, '0'));
    }
  }
  return expanded.slice(0, 8).join(':').toLowerCase();
}

function isPrivateOrReserved(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
  }
  if (isIP(ip) === 6) {
    if (ip.startsWith('fe80') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
    if (ip === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  }
  return false;
}

export function lookupAsn(ip: string): { asn: number; organization: string } | null {
  if (isPrivateOrReserved(ip)) return null;
  // In production, this would query a local MaxMind/IP2Location database.
  // For MVP, return null (unknown). The pipeline handles this gracefully.
  return null;
}

function matchesPtrSuffix(hostname: string, validSuffixes: string[]): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  return validSuffixes.some((suffix) => {
    const s = suffix.toLowerCase();
    if (lower === s.slice(1)) return true;
    return lower.endsWith(s);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

async function dnsReverseWithTimeout(ip: string): Promise<string[]> {
  return withTimeout(dns.reverse(ip), DNS_TIMEOUT_MS, []);
}

async function dnsResolveWithTimeout(hostname: string, ipVersion: 4 | 6): Promise<string[]> {
  const lookup = ipVersion === 4 ? dns.resolve4(hostname) : dns.resolve6(hostname);
  return withTimeout(lookup, DNS_TIMEOUT_MS, []);
}

export async function verifyBotIdentity(
  ip: string,
  userAgent: string,
): Promise<{
  verified: boolean;
  botIdentity: string | null;
  definition: BotDefinition | null;
}> {
  const matchedDef = KNOWN_BOT_DEFINITIONS.find((d) => d.userAgentPattern.test(userAgent));
  if (!matchedDef) {
    return { verified: false, botIdentity: null, definition: null };
  }

  if (isPrivateOrReserved(ip)) {
    return { verified: false, botIdentity: null, definition: matchedDef };
  }

  const hostnames = await dnsReverseWithTimeout(ip);
  if (hostnames.length === 0) {
    return { verified: false, botIdentity: null, definition: matchedDef };
  }

  for (const hostname of hostnames) {
    if (!matchesPtrSuffix(hostname, matchedDef.validPtrSuffixes)) {
      continue;
    }

    const ipVersion = isIP(ip);
    if (ipVersion !== 4 && ipVersion !== 6) continue;

    const resolvedIps = await dnsResolveWithTimeout(hostname, ipVersion);
    const normalizedOriginal = normalizeIp(ip);
    const match = resolvedIps.some((r) => normalizeIp(r) === normalizedOriginal);

    if (match) {
      return { verified: true, botIdentity: matchedDef.botIdentity, definition: matchedDef };
    }
  }

  return { verified: false, botIdentity: null, definition: matchedDef };
}

export async function collectEvidence(
  ip: string,
  userAgent: string,
): Promise<NetworkEvidence> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const botResult = await verifyBotIdentity(ip, userAgent);

  if (botResult.verified && botResult.definition) {
    return {
      status: 'verified_bot',
      asn: null,
      organization: null,
      botIdentity: botResult.botIdentity,
      stale: false,
      sourceId: botResult.definition.sourceId,
      sourceVersion: botResult.definition.sourceVersion,
      fetchedAt: now,
      expiresAt: expiresAt,
      verificationMethod: botResult.definition.verificationMethod,
      verifiedAt: now,
    };
  }

  const asnResult = lookupAsn(ip);

  if (asnResult) {
    const asnExpiry = new Date(Date.now() + ASN_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    return {
      status: 'network_association',
      asn: asnResult.asn,
      organization: asnResult.organization,
      botIdentity: null,
      stale: false,
      sourceId: ASN_SOURCE_ID,
      sourceVersion: ASN_SOURCE_VERSION,
      fetchedAt: now,
      expiresAt: asnExpiry,
      verificationMethod: null,
      verifiedAt: null,
    };
  }

  if (isPrivateOrReserved(ip)) {
    return {
      status: 'unavailable',
      asn: null,
      organization: null,
      botIdentity: null,
      stale: false,
      sourceId: null,
      sourceVersion: null,
      fetchedAt: now,
      expiresAt: null,
      verificationMethod: null,
      verifiedAt: null,
    };
  }

  return {
    status: 'unknown',
    asn: null,
    organization: null,
    botIdentity: null,
    stale: false,
    sourceId: null,
    sourceVersion: null,
    fetchedAt: now,
    expiresAt: null,
    verificationMethod: null,
    verifiedAt: null,
  };
}
