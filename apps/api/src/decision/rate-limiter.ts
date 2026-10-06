interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxPerDay: number;
  maxPerMonth: number;
}

const DEFAULT_TENANT_LIMITS: RateLimitConfig = {
  maxPerDay: 50_000,
  maxPerMonth: 1_000_000,
};

const DEFAULT_GLOBAL_LIMITS: RateLimitConfig = {
  maxPerDay: 500_000,
  maxPerMonth: 10_000_000,
};

const tenantDayWindows = new Map<string, RateLimitWindow>();
const tenantMonthWindows = new Map<string, RateLimitWindow>();
const globalDay: RateLimitWindow = { count: 0, resetAt: getEndOfDay() };
const globalMonth: RateLimitWindow = { count: 0, resetAt: getEndOfMonth() };

function getEndOfDay(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

function getEndOfMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

function getOrResetWindow(window: RateLimitWindow): RateLimitWindow {
  const now = Date.now();
  if (now >= window.resetAt) {
    window.count = 0;
    if (window.resetAt === globalDay.resetAt || window === globalDay) {
      window.resetAt = getEndOfDay();
    } else {
      window.resetAt = getEndOfMonth();
    }
  }
  return window;
}

function getTenantWindow(
  map: Map<string, RateLimitWindow>,
  tenantId: string,
  resetFn: () => number,
): RateLimitWindow {
  let window = map.get(tenantId);
  if (!window) {
    window = { count: 0, resetAt: resetFn() };
    map.set(tenantId, window);
  }
  return getOrResetWindow(window);
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export function checkRateLimit(
  tenantId: string,
  tenantLimits: RateLimitConfig = DEFAULT_TENANT_LIMITS,
  globalLimits: RateLimitConfig = DEFAULT_GLOBAL_LIMITS,
): RateLimitResult {
  const tenantDay = getTenantWindow(tenantDayWindows, tenantId, getEndOfDay);
  if (tenantDay.count >= tenantLimits.maxPerDay) {
    return {
      allowed: false,
      reason: 'Tenant daily rate limit exceeded',
      retryAfterMs: tenantDay.resetAt - Date.now(),
    };
  }

  const tenantMonth = getTenantWindow(tenantMonthWindows, tenantId, getEndOfMonth);
  if (tenantMonth.count >= tenantLimits.maxPerMonth) {
    return {
      allowed: false,
      reason: 'Tenant monthly rate limit exceeded',
      retryAfterMs: tenantMonth.resetAt - Date.now(),
    };
  }

  const gDay = getOrResetWindow(globalDay);
  if (gDay.count >= globalLimits.maxPerDay) {
    return {
      allowed: false,
      reason: 'Global daily rate limit exceeded',
      retryAfterMs: gDay.resetAt - Date.now(),
    };
  }

  const gMonth = getOrResetWindow(globalMonth);
  if (gMonth.count >= globalLimits.maxPerMonth) {
    return {
      allowed: false,
      reason: 'Global monthly rate limit exceeded',
      retryAfterMs: gMonth.resetAt - Date.now(),
    };
  }

  return { allowed: true };
}

export function recordRequest(tenantId: string): void {
  const tenantDay = getTenantWindow(tenantDayWindows, tenantId, getEndOfDay);
  tenantDay.count++;

  const tenantMonth = getTenantWindow(tenantMonthWindows, tenantId, getEndOfMonth);
  tenantMonth.count++;

  const gDay = getOrResetWindow(globalDay);
  gDay.count++;

  const gMonth = getOrResetWindow(globalMonth);
  gMonth.count++;
}

export function resetForTesting(): void {
  tenantDayWindows.clear();
  tenantMonthWindows.clear();
  globalDay.count = 0;
  globalDay.resetAt = getEndOfDay();
  globalMonth.count = 0;
  globalMonth.resetAt = getEndOfMonth();
}
