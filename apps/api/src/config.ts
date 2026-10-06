import { randomBytes } from 'node:crypto';

export type JevAdapterKind = 'real' | 'openrouter' | 'mock';

export interface AppConfig {
  isProduction: boolean;
  port: number;
  databaseUrl: string | undefined;
  jwtSecret: string;
  jwtTtlSeconds: number;
  /** Exact origins allowed by CORS. Empty in development means "any localhost origin". */
  corsOrigins: string[];
  /** Peer IPs allowed to set X-Forwarded-For (e.g. the Caddy container). */
  trustedProxies: string[];
  /** Public base URL of this router, used to reject destinations that loop back to it. */
  publicBaseUrl: string | undefined;
  jevAdapter: JevAdapterKind;
  jevApiKey: string | undefined;
  openRouterApiKey: string | undefined;
  /** Jev call deadline. Spec: 600ms for the real API; the OpenRouter stand-in is an LLM and needs more. */
  jevTimeoutMs: number | undefined;
}

function list(value: string | undefined): string[] {
  return (value ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Reads configuration from the environment.
 * In production every security-relevant setting must be explicit; startup fails otherwise.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env['NODE_ENV'] === 'production';
  const problems: string[] = [];

  let jwtSecret = env['JWT_SECRET'] ?? '';
  if (!jwtSecret) {
    if (isProduction) problems.push('JWT_SECRET is required');
    // Dev only: a per-process secret. Tokens stop working after a restart, which is fine locally.
    jwtSecret = randomBytes(32).toString('hex');
  } else if (jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters');
  }

  const corsOrigins = list(env['CORS_ORIGINS']);
  if (isProduction && corsOrigins.length === 0) problems.push('CORS_ORIGINS is required (comma-separated origins)');

  const databaseUrl = env['DATABASE_URL'];
  if (isProduction && !databaseUrl) problems.push('DATABASE_URL is required');

  const jevApiKey = env['JEV_API_KEY'] || undefined;
  const openRouterApiKey = env['OPENROUTER_API_KEY'] || undefined;
  const requested = (env['JEV_ADAPTER'] ?? '').toLowerCase();
  let jevAdapter: JevAdapterKind;
  if (requested === 'real' || requested === 'openrouter' || requested === 'mock') {
    jevAdapter = requested;
  } else if (requested) {
    problems.push(`JEV_ADAPTER must be real, openrouter or mock (got "${requested}")`);
    jevAdapter = 'mock';
  } else {
    jevAdapter = jevApiKey ? 'real' : openRouterApiKey ? 'openrouter' : 'mock';
  }
  if (jevAdapter === 'real' && !jevApiKey) problems.push('JEV_ADAPTER=real needs JEV_API_KEY');
  if (jevAdapter === 'openrouter' && !openRouterApiKey) problems.push('JEV_ADAPTER=openrouter needs OPENROUTER_API_KEY');
  if (isProduction && jevAdapter === 'mock') problems.push('The mock Jev adapter is not allowed in production');

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
  }

  return {
    isProduction,
    port: Number(env['PORT'] ?? 3000),
    databaseUrl,
    jwtSecret,
    jwtTtlSeconds: Number(env['JWT_TTL_SECONDS'] ?? 8 * 60 * 60),
    corsOrigins,
    trustedProxies: list(env['TRUSTED_PROXIES']),
    publicBaseUrl: env['PUBLIC_BASE_URL'] || undefined,
    jevAdapter,
    jevApiKey,
    openRouterApiKey,
    jevTimeoutMs: env['JEV_TIMEOUT_MS'] ? Number(env['JEV_TIMEOUT_MS']) : undefined,
  };
}

let current: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!current) current = loadConfig();
  return current;
}

/** Tests replace the config instead of mutating process.env. */
export function setConfigForTesting(config: AppConfig): void {
  current = config;
}
