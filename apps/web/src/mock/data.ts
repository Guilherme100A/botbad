import type {
  Campaign,
  CampaignStatus,
  Destination,
  NetworkProfile,
  DecisionEvent,
  RoutingAction,
  DecisionSource,
  ReasonCode,
  Assessment,
  NetworkEvidenceStatus,
  Tenant,
  Role,
  Membership,
} from '@botbad/contracts';

const NOW = '2026-10-06T00:00:00.000Z';
const TENANT_ID = '00000000-0000-4000-a000-000000000001';

function uid(prefix: string, n: number): string {
  const p = String(n).padStart(4, '0');
  return `${prefix}-0000-4000-a000-00000000${p}`;
}

// ── Destinations ──

export const initialDestinations: Destination[] = [
  { id: uid('d0000001', 1), tenantId: TENANT_ID, url: 'https://example.com/landing', label: 'Landing principal', createdAt: NOW, updatedAt: NOW },
  { id: uid('d0000001', 2), tenantId: TENANT_ID, url: 'https://example.com/alt', label: 'Página alternativa', createdAt: NOW, updatedAt: NOW },
  { id: uid('d0000001', 3), tenantId: TENANT_ID, url: 'https://blackfriday.example.com/oferta', label: 'Oferta Black Friday', createdAt: NOW, updatedAt: NOW },
  { id: uid('d0000001', 4), tenantId: TENANT_ID, url: 'https://blackfriday.example.com/safe', label: 'Safe page BF', createdAt: NOW, updatedAt: NOW },
  { id: uid('d0000001', 5), tenantId: TENANT_ID, url: 'https://tiktok-lp.example.com', label: 'Landing TikTok', createdAt: NOW, updatedAt: NOW },
  { id: uid('d0000001', 6), tenantId: TENANT_ID, url: 'https://tiktok-lp.example.com/alt', label: 'Alt TikTok', createdAt: NOW, updatedAt: NOW },
];

// ── Campaigns ──

export const initialCampaigns: Campaign[] = [
  {
    id: uid('c0000001', 1), tenantId: TENANT_ID,
    name: 'Oferta Black Friday', slug: 'oferta-bf',
    primaryDestinationId: initialDestinations[2].id,
    alternativeDestinationId: initialDestinations[3].id,
    networkProfile: 'general', status: 'active',
    policyVersion: '1.0.0', createdAt: NOW, updatedAt: NOW,
  },
  {
    id: uid('c0000001', 2), tenantId: TENANT_ID,
    name: 'Landing TikTok Q4', slug: 'landing-tiktok-q4',
    primaryDestinationId: initialDestinations[4].id,
    alternativeDestinationId: initialDestinations[5].id,
    networkProfile: 'tiktok', status: 'active',
    policyVersion: '1.0.0', createdAt: NOW, updatedAt: NOW,
  },
  {
    id: uid('c0000001', 3), tenantId: TENANT_ID,
    name: 'Campanha Meta Ads', slug: 'meta-ads',
    primaryDestinationId: initialDestinations[0].id,
    alternativeDestinationId: initialDestinations[1].id,
    networkProfile: 'meta', status: 'paused',
    policyVersion: '1.0.0', createdAt: NOW, updatedAt: NOW,
  },
  {
    id: uid('c0000001', 4), tenantId: TENANT_ID,
    name: 'Teste Google', slug: 'teste-google',
    primaryDestinationId: initialDestinations[0].id,
    alternativeDestinationId: initialDestinations[1].id,
    networkProfile: 'google', status: 'draft',
    policyVersion: '1.0.0', createdAt: NOW, updatedAt: NOW,
  },
];

// ── Decision Events ──

type EventPattern = {
  action: RoutingAction;
  source: DecisionSource;
  reasonCode: ReasonCode;
  assessment: Assessment | null;
  confidence: number | null;
  evidenceStatus: NetworkEvidenceStatus;
  botIdentity: string | null;
};

const patterns: EventPattern[] = [
  { action: 'route_primary', source: 'jev', reasonCode: 'JEV_HUMAN_PRIMARY', assessment: 'likely_human', confidence: 0.82, evidenceStatus: 'unknown', botIdentity: null },
  { action: 'route_alternative', source: 'rule', reasonCode: 'VERIFIED_BOT_ALTERNATIVE', assessment: null, confidence: null, evidenceStatus: 'verified_bot', botIdentity: 'googlebot' },
  { action: 'route_primary', source: 'jev', reasonCode: 'JEV_HUMAN_PRIMARY', assessment: 'likely_human', confidence: 0.91, evidenceStatus: 'unknown', botIdentity: null },
  { action: 'route_alternative', source: 'jev', reasonCode: 'JEV_AUTOMATION_ALTERNATIVE', assessment: 'likely_automation', confidence: 0.88, evidenceStatus: 'network_association', botIdentity: null },
  { action: 'challenge', source: 'jev', reasonCode: 'LOW_EVIDENCE_CHALLENGE', assessment: 'insufficient_evidence', confidence: 0.42, evidenceStatus: 'unavailable', botIdentity: null },
  { action: 'route_primary', source: 'cache', reasonCode: 'JEV_HUMAN_PRIMARY', assessment: 'likely_human', confidence: 0.85, evidenceStatus: 'unknown', botIdentity: null },
  { action: 'route_alternative', source: 'rule', reasonCode: 'VERIFIED_BOT_ALTERNATIVE', assessment: null, confidence: null, evidenceStatus: 'verified_bot', botIdentity: 'bingbot' },
  { action: 'route_primary', source: 'jev', reasonCode: 'JEV_HUMAN_PRIMARY', assessment: 'likely_human', confidence: 0.78, evidenceStatus: 'unknown', botIdentity: null },
  { action: 'route_alternative', source: 'jev', reasonCode: 'JEV_AUTOMATION_ALTERNATIVE', assessment: 'likely_automation', confidence: 0.93, evidenceStatus: 'network_association', botIdentity: null },
  { action: 'route_primary', source: 'jev', reasonCode: 'JEV_HUMAN_PRIMARY', assessment: 'likely_human', confidence: 0.86, evidenceStatus: 'unknown', botIdentity: null },
];

const campaignIds = initialCampaigns.map(c => c.id);

function makeEvent(i: number): DecisionEvent {
  const p = patterns[i % patterns.length];
  const campaignId = campaignIds[i % campaignIds.length];
  const campaign = initialCampaigns.find(c => c.id === campaignId)!;
  const destId = p.action === 'route_primary'
    ? campaign.primaryDestinationId
    : p.action === 'route_alternative'
      ? campaign.alternativeDestinationId
      : null;

  return {
    id: uid('e0000001', i + 1),
    tenantId: TENANT_ID,
    campaignId,
    decisionId: uid('dc000001', i + 1),
    action: p.action,
    destinationId: destId,
    source: p.source,
    reasonCode: p.reasonCode,
    networkProfile: campaign.networkProfile,
    policyVersion: '1.0.0',
    profileVersion: '1.0.0',
    featureVersion: '1.0.0',
    networkEvidenceStatus: p.evidenceStatus,
    networkEvidenceVersion: null,
    botIdentity: p.botIdentity,
    jevAssessment: p.assessment,
    jevConfidence: p.confidence,
    jevModelVersion: p.assessment ? 'jev-1.13.0' : null,
    jevInputTokens: p.assessment ? 480 : null,
    durationMs: 8 + (i * 3) % 25,
    timestamp: new Date(Date.parse('2026-10-06T00:00:00Z') - i * 37000).toISOString(),
  };
}

export const decisionEvents: DecisionEvent[] = Array.from({ length: 40 }, (_, i) => makeEvent(i));

// ── Dashboard stats ──

export const dashboardStats = {
  totalAccesses: 12847,
  routePrimary: 8932,
  routeAlternative: 3201,
  challenge: 489,
  deny: 225,
  latencyP95Ms: 23,
  engineHealthy: true,
  decisionSources: { rule: 2814, cache: 1203, jev: 8512, fallback: 318 },
};

// ── Simulation scenarios (fixture data — identified as such) ──

export const SIMULATION_SCENARIOS = [
  {
    name: 'Cliente provável',
    key: 'likely_human',
    description: 'Visitante humano com evidência suficiente — encaminha ao destino principal.',
    expectedAssessment: 'likely_human' as Assessment,
    expectedAction: 'route_primary' as RoutingAction,
    expectedReasonCode: 'JEV_HUMAN_PRIMARY' as ReasonCode,
    expectedSource: 'jev' as DecisionSource,
  },
  {
    name: 'Bot verificado',
    key: 'verified_bot',
    description: 'Googlebot verificado — encaminha à alternativa por regra, sem chamar Jev.',
    expectedAssessment: null,
    expectedAction: 'route_alternative' as RoutingAction,
    expectedReasonCode: 'VERIFIED_BOT_ALTERNATIVE' as ReasonCode,
    expectedSource: 'rule' as DecisionSource,
  },
  {
    name: 'Automação provável',
    key: 'likely_automation',
    description: 'Automação identificada pelo Jev — encaminha à alternativa.',
    expectedAssessment: 'likely_automation' as Assessment,
    expectedAction: 'route_alternative' as RoutingAction,
    expectedReasonCode: 'JEV_AUTOMATION_ALTERNATIVE' as ReasonCode,
    expectedSource: 'jev' as DecisionSource,
  },
  {
    name: 'Evidência insuficiente',
    key: 'insufficient_evidence',
    description: 'Baixa confiança / sinais insuficientes — desafio e fallback à alternativa.',
    expectedAssessment: 'insufficient_evidence' as Assessment,
    expectedAction: 'challenge' as RoutingAction,
    expectedReasonCode: 'LOW_EVIDENCE_CHALLENGE' as ReasonCode,
    expectedSource: 'jev' as DecisionSource,
  },
] as const;

// ── Engine status ──

export const engineStatus = {
  model: 'jev-1.13.0',
  policyVersion: '1.0.0',
  profileVersion: '1.0.0',
  mode: 'shadow' as const,
  budgetUsedTokens: 245000,
  budgetLimitTokens: 1000000,
  timeoutMs: 3000,
  healthy: true,
  lastHealthCheck: NOW,
};

// ── Tenant settings ──

export const tenantSettings = {
  tenant: { id: TENANT_ID, name: 'Minha Organização', createdAt: NOW } satisfies Tenant,
  members: [
    { id: uid('m0000001', 1), tenantId: TENANT_ID, userId: uid('u0000001', 1), role: 'owner' as Role, createdAt: NOW },
    { id: uid('m0000001', 2), tenantId: TENANT_ID, userId: uid('u0000001', 2), role: 'operator' as Role, createdAt: NOW },
    { id: uid('m0000001', 3), tenantId: TENANT_ID, userId: uid('u0000001', 3), role: 'viewer' as Role, createdAt: NOW },
  ] satisfies Membership[],
  limits: {
    maxCampaigns: 50,
    maxDestinations: 100,
    maxRequestsPerMinute: 1000,
    jevBudgetDailyTokens: 1000000,
  },
};

// ── Helpers ──

export function getDestination(destinations: Destination[], id: string | null): Destination | undefined {
  if (!id) return undefined;
  return destinations.find(d => d.id === id);
}

export function getCampaignById(campaigns: Campaign[], id: string): Campaign | undefined {
  return campaigns.find(c => c.id === id);
}

export const NETWORK_PROFILE_LABELS: Record<NetworkProfile, string> = {
  general: 'Geral',
  tiktok: 'TikTok',
  meta: 'Meta',
  google: 'Google',
  x: 'X',
  organic: 'Orgânico',
  custom: 'Customizado',
};

export const ACTION_LABELS: Record<RoutingAction, string> = {
  route_primary: 'Página principal',
  route_alternative: 'Página alternativa',
  challenge: 'Desafio',
  deny: 'Negação',
};

export const SOURCE_LABELS: Record<DecisionSource, string> = {
  rule: 'Regra',
  cache: 'Cache',
  jev: 'Jev',
  fallback: 'Fallback',
};

export const REASON_LABELS: Record<ReasonCode, string> = {
  VERIFIED_BOT_ALTERNATIVE: 'Bot verificado → alternativa',
  JEV_AUTOMATION_ALTERNATIVE: 'Jev: automação → alternativa',
  JEV_HUMAN_PRIMARY: 'Jev: humano → principal',
  LOW_EVIDENCE_CHALLENGE: 'Evidência baixa → desafio',
  ENGINE_FAILURE_ALTERNATIVE: 'Falha do motor → alternativa',
  RATE_LIMIT: 'Limite de taxa',
  RULE_ABUSE: 'Abuso por regra',
  CAMPAIGN_INVALID: 'Campanha inválida',
  DESTINATION_INVALID: 'Destino inválido',
  BUDGET_EXHAUSTED: 'Orçamento esgotado',
  CHALLENGE_APPROVED: 'Desafio aprovado',
  CHALLENGE_FAILED: 'Desafio reprovado',
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  archived: 'Arquivada',
};

// ── Demo fixtures in the API's shapes (shown only when the API is unreachable, with a DemoBadge) ──

export const DEMO_METRICS = {
  days: 30,
  totalAccesses: dashboardStats.totalAccesses,
  routePrimary: dashboardStats.routePrimary,
  routeAlternative: dashboardStats.routeAlternative,
  challenge: dashboardStats.challenge,
  deny: dashboardStats.deny,
  latencyP95Ms: dashboardStats.latencyP95Ms,
  decisionSources: dashboardStats.decisionSources,
};

export const DEMO_ENGINE = {
  adapter: 'mock' as const,
  model: engineStatus.model,
  healthy: engineStatus.healthy,
  circuit: 'closed' as const,
  mode: engineStatus.mode,
  policyVersion: engineStatus.policyVersion,
  profileVersion: engineStatus.profileVersion,
  timeoutMs: 600,
  thresholds: { primary: 0.75, automation: 0.6, maxAutomationForPrimary: 0.3 },
  budget: { usedToday: 12000, usedMonth: engineStatus.budgetUsedTokens, dailyLimit: 50_000_000, monthlyLimit: engineStatus.budgetLimitTokens },
  checkedAt: engineStatus.lastHealthCheck,
};

export const DEMO_TENANT = {
  tenant: { id: tenantSettings.tenant.id, name: tenantSettings.tenant.name, createdAt: tenantSettings.tenant.createdAt },
  members: [
    { id: uid('m0000001', 1), userId: uid('u0000001', 1), email: 'dono@exemplo.com', name: 'Dono', role: 'owner' as const, createdAt: NOW },
    { id: uid('m0000001', 2), userId: uid('u0000001', 2), email: 'operador@exemplo.com', name: null, role: 'operator' as const, createdAt: NOW },
    { id: uid('m0000001', 3), userId: uid('u0000001', 3), email: 'leitura@exemplo.com', name: null, role: 'viewer' as const, createdAt: NOW },
  ],
  limits: { requestsPerDay: 50_000, requestsPerMonth: 1_000_000, requestsPerMinutePerVisitor: 120, jevTokensPerDay: 50_000_000, jevTokensPerMonth: 500_000_000 },
};
