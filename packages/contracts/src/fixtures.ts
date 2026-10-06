import { randomUUID } from 'node:crypto';
import type { NetworkEvidence, NetworkEvidenceStatus, NetworkProfile } from './network.js';
import { NetworkEvidenceSchema } from './network.js';
import type { Assessment, JevAssessment } from './assessment.js';
import { JevAssessmentSchema } from './assessment.js';
import type { RoutingAction, DecisionSource } from './routing.js';
import { RoutingDecisionSchema, type ReasonCode } from './routing.js';
import type { Campaign, Destination } from './campaign.js';
import { CampaignSchema } from './campaign.js';

// ── WARNING: ALL DATA BELOW IS SYNTHETIC TEST FIXTURE ──
// Never present fixture results as real Jev assessments or production data.

const NOW = '2026-10-06T00:00:00.000Z';

// ── Tenant ──

export const FIXTURE_TENANT = {
  id: '00000000-0000-4000-a000-000000000001',
  name: 'fixture-tenant',
  createdAt: NOW,
} as const;

// ── Destinations ──

export const FIXTURE_DESTINATIONS = {
  primary: {
    id: '00000000-0000-4000-a000-000000000010',
    tenantId: FIXTURE_TENANT.id,
    url: 'https://example.com/landing',
    label: 'Primary landing page (fixture)',
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies Destination,
  alternative: {
    id: '00000000-0000-4000-a000-000000000020',
    tenantId: FIXTURE_TENANT.id,
    url: 'https://example.com/alt',
    label: 'Alternative page (fixture)',
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies Destination,
} as const;

// ── Network Evidence factories ──

const NETWORK_EVIDENCE_DEFAULTS: NetworkEvidence = {
  status: 'unknown',
  asn: null,
  organization: null,
  botIdentity: null,
  stale: false,
  sourceId: null,
  sourceVersion: null,
  fetchedAt: null,
  expiresAt: null,
  verificationMethod: null,
  verifiedAt: null,
};

export function createMockNetworkEvidence(
  overrides?: Partial<NetworkEvidence>,
): NetworkEvidence {
  const merged = { ...NETWORK_EVIDENCE_DEFAULTS, ...overrides };
  return NetworkEvidenceSchema.parse(merged);
}

export function createVerifiedBotEvidence(
  botIdentity: string,
  overrides?: Partial<NetworkEvidence>,
): NetworkEvidence {
  return createMockNetworkEvidence({
    status: 'verified_bot',
    botIdentity,
    sourceId: 'fixture-bot-list',
    sourceVersion: '1.0.0',
    fetchedAt: NOW,
    expiresAt: '2026-10-07T00:00:00.000Z',
    verificationMethod: 'dns-reverse-forward',
    verifiedAt: NOW,
    ...overrides,
  });
}

export function createNetworkAssociationEvidence(
  asn: number,
  organization: string,
  overrides?: Partial<NetworkEvidence>,
): NetworkEvidence {
  return createMockNetworkEvidence({
    status: 'network_association',
    asn,
    organization,
    sourceId: 'fixture-asn-db',
    sourceVersion: '2026-10-01',
    fetchedAt: NOW,
    expiresAt: '2026-10-13T00:00:00.000Z',
    ...overrides,
  });
}

// ── Jev Assessment factory ──

const JEV_ASSESSMENT_DEFAULTS: JevAssessment = {
  assessment: 'likely_human',
  probabilities: {
    likely_human: 0.85,
    likely_automation: 0.10,
    insufficient_evidence: 0.05,
  },
  confidence: 0.82,
  modelVersion: 'jev-1.13.0',
  inputTokens: 480,
};

export function createMockJevAssessment(
  assessment: Assessment,
  overrides?: Partial<JevAssessment>,
): JevAssessment {
  const probabilityPresets: Record<Assessment, JevAssessment['probabilities']> = {
    likely_human: { likely_human: 0.85, likely_automation: 0.10, insufficient_evidence: 0.05 },
    likely_automation: { likely_human: 0.08, likely_automation: 0.88, insufficient_evidence: 0.04 },
    insufficient_evidence: { likely_human: 0.35, likely_automation: 0.30, insufficient_evidence: 0.35 },
  };

  const merged = {
    ...JEV_ASSESSMENT_DEFAULTS,
    assessment,
    probabilities: probabilityPresets[assessment],
    ...overrides,
  };
  return JevAssessmentSchema.parse(merged);
}

// ── Routing Decision factory ──

export function createMockRoutingDecision(
  action: RoutingAction,
  source: DecisionSource,
  reasonCode: ReasonCode,
  overrides?: Partial<ReturnType<typeof RoutingDecisionSchema.parse>>,
) {
  const needsDestination = action === 'route_primary' || action === 'route_alternative';
  const destinationId = needsDestination
    ? (action === 'route_primary'
      ? FIXTURE_DESTINATIONS.primary.id
      : FIXTURE_DESTINATIONS.alternative.id)
    : null;

  const base = {
    action,
    destinationId,
    botIdentity: null,
    source,
    reasonCode,
    policyVersion: '1.0.0',
    networkProfile: 'general' as NetworkProfile,
    profileVersion: '1.0.0',
    networkEvidenceVersion: null,
    featureVersion: '1.0.0',
    decisionId: overrides?.decisionId ?? randomUUID(),
    durationMs: 12,
    ...overrides,
  };
  return RoutingDecisionSchema.parse(base);
}

// ── Campaign factory ──

export function createMockCampaign(
  overrides?: Partial<Campaign>,
): Campaign {
  const base = {
    id: overrides?.id ?? randomUUID(),
    tenantId: FIXTURE_TENANT.id,
    name: 'Test Campaign (fixture)',
    slug: 'test-campaign',
    primaryDestinationId: FIXTURE_DESTINATIONS.primary.id,
    alternativeDestinationId: FIXTURE_DESTINATIONS.alternative.id,
    networkProfile: 'general' as NetworkProfile,
    status: 'draft' as const,
    policyVersion: '1.0.0',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  return CampaignSchema.parse(base);
}

// ── Simulation scenarios ──

export const SIMULATION_SCENARIOS = [
  {
    name: 'likely_human',
    description: 'Human visitor with sufficient evidence — routes to primary',
    evidence: createMockNetworkEvidence(),
    expectedAssessment: 'likely_human' as Assessment,
    expectedAction: 'route_primary' as RoutingAction,
    expectedReasonCode: 'JEV_HUMAN_PRIMARY' as ReasonCode,
    expectedSource: 'jev' as const,
  },
  {
    name: 'verified_bot',
    description: 'Verified Googlebot — routes to alternative by rule, no Jev call',
    evidence: createVerifiedBotEvidence('googlebot'),
    expectedAssessment: null,
    expectedAction: 'route_alternative' as RoutingAction,
    expectedReasonCode: 'VERIFIED_BOT_ALTERNATIVE' as ReasonCode,
    expectedSource: 'rule' as const,
  },
  {
    name: 'likely_automation',
    description: 'Automation probable by Jev — routes to alternative',
    evidence: createNetworkAssociationEvidence(13414, 'Twitter Inc.'),
    expectedAssessment: 'likely_automation' as Assessment,
    expectedAction: 'route_alternative' as RoutingAction,
    expectedReasonCode: 'JEV_AUTOMATION_ALTERNATIVE' as ReasonCode,
    expectedSource: 'jev' as const,
  },
  {
    name: 'insufficient_evidence',
    description: 'Low confidence / missing signals — challenge then fallback to alternative',
    evidence: createMockNetworkEvidence({ status: 'unavailable' }),
    expectedAssessment: 'insufficient_evidence' as Assessment,
    expectedAction: 'challenge' as RoutingAction,
    expectedReasonCode: 'LOW_EVIDENCE_CHALLENGE' as ReasonCode,
    expectedSource: 'jev' as const,
  },
] as const;
