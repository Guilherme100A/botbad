import type { Campaign, Destination, DecisionEvent } from '@botbad/contracts';

// In production the panel and the API share an origin behind Caddy; in dev the API runs on :3000.
const BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '');
const TOKEN_KEY = 'jev_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* noop */ }
}

export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  // A 401 from the login form means wrong credentials, not an expired session.
  if (res.status === 401 && path !== '/auth/login') {
    clearToken();
    window.location.hash = '#/login';
    throw new ApiError(401, 'UNAUTHORIZED', 'Sessão expirada. Faça login novamente.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.code ?? 'UNKNOWN', data.message ?? 'Erro desconhecido');
  }

  return data as T;
}

// ── Auth ──

export interface Session {
  user: { id: string; email: string; name: string | null };
  tenant: { id: string; name: string };
  role: 'owner' | 'operator' | 'viewer';
}

export async function login(email: string, password: string): Promise<Session & { token: string }> {
  const data = await request<Session & { token: string }>('POST', '/auth/login', { email, password });
  setToken(data.token);
  return data;
}

export async function getSession(): Promise<Session> {
  return request<Session>('GET', '/auth/me');
}

// ── Campaigns ──

export async function listCampaigns(): Promise<Campaign[]> {
  const data = await request<{ items: Campaign[] }>('GET', '/campaigns');
  return data.items;
}

export async function getCampaign(id: string): Promise<Campaign> {
  return request<Campaign>('GET', `/campaigns/${id}`);
}

export async function createCampaign(input: {
  name: string;
  primaryDestinationId: string;
  alternativeDestinationId: string;
  networkProfile?: string;
}): Promise<Campaign> {
  return request<Campaign>('POST', '/campaigns', input);
}

export async function updateCampaign(
  id: string,
  input: Partial<{ name: string; primaryDestinationId: string; alternativeDestinationId: string; networkProfile: string }>,
): Promise<Campaign> {
  return request<Campaign>('PATCH', `/campaigns/${id}`, input);
}

export async function activateCampaign(id: string): Promise<Campaign> {
  return request<Campaign>('POST', `/campaigns/${id}/activate`);
}

export async function pauseCampaign(id: string): Promise<Campaign> {
  return request<Campaign>('POST', `/campaigns/${id}/pause`);
}

// ── Destinations ──

export async function listDestinations(): Promise<Destination[]> {
  const data = await request<{ items: Destination[] }>('GET', '/destinations');
  return data.items;
}

export async function createDestination(input: { url: string; label: string }): Promise<Destination> {
  return request<Destination>('POST', '/destinations', input);
}

// ── Events ──

export async function listCampaignEvents(campaignId: string): Promise<DecisionEvent[]> {
  const data = await request<{ items: DecisionEvent[] }>('GET', `/campaigns/${campaignId}/events`);
  return data.items;
}

// ── Health check (non-authenticated) ──

export async function isApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/campaigns`, {
      method: 'HEAD',
      headers: { 'Authorization': `Bearer ${getToken() ?? ''}` },
      signal: AbortSignal.timeout(2000),
    });
    return res.status !== 0;
  } catch {
    return false;
  }
}
