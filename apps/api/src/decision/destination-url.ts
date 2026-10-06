import { BlockList, isIP } from 'node:net';

export type DestinationCheck = { ok: true; url: URL } | { ok: false; reason: string };

// Visitors are redirected here, so a destination must be a public HTTPS site.
const BLOCKED = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) BLOCKED.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['::ffff:0:0', 96],
] as const) BLOCKED.addSubnet(net, bits, 'ipv6');

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp', '.intranet'];

/**
 * @param publicBaseUrl this router's own public URL; a destination pointing back at /r/* on it would loop.
 */
export function checkDestinationUrl(raw: string, publicBaseUrl?: string): DestinationCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL inválida.' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'O destino precisa usar https.' };
  if (url.username || url.password) return { ok: false, reason: 'O destino não pode conter usuário ou senha.' };

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const family = isIP(host);
  if (family) {
    if (BLOCKED.check(host, family === 6 ? 'ipv6' : 'ipv4')) {
      return { ok: false, reason: 'O destino não pode ser um endereço de rede interna.' };
    }
  } else {
    if (host === 'localhost' || INTERNAL_SUFFIXES.some(s => host.endsWith(s))) {
      return { ok: false, reason: 'O destino não pode ser um host interno.' };
    }
    if (!host.includes('.')) return { ok: false, reason: 'O destino precisa de um domínio público.' };
  }

  if (publicBaseUrl) {
    try {
      const self = new URL(publicBaseUrl);
      if (self.hostname.toLowerCase() === host && url.pathname.startsWith('/r/')) {
        return { ok: false, reason: 'O destino aponta para o próprio roteador (loop).' };
      }
    } catch { /* misconfigured PUBLIC_BASE_URL: config.ts reports it at startup */ }
  }

  return { ok: true, url };
}
