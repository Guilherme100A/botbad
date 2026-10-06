import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type {
  RoutingDecision,
  NetworkEvidence,
  NetworkProfile,
  JevAdapter,
  JevRequestContext,
  JevAssessment,
} from '@botbad/contracts';
import { campaigns, destinations, decisionEvents } from '@botbad/db';
import { getDb } from '../db.js';
import { extractClientIp, collectEvidence } from './evidence.js';
import { checkRateLimit, recordRequest } from './rate-limiter.js';
import { jevCircuitBreaker } from './circuit-breaker.js';
import { reserveBudget, reconcileBudget, releaseBudget } from './budget.js';
import { JevApiError, JevTimeoutError } from '../adapters/jev-real.js';

const POLICY_VERSION = '1.0.0';
const PROFILE_VERSION = '1.0.0';
const FEATURE_VERSION = '1.0.0';

export interface PipelineInput {
  slug: string;
  peerIp: string;
  userAgent: string;
  headers: Record<string, string | undefined>;
  trustedProxies?: string[];
}

export interface PipelineResult {
  decision: RoutingDecision;
  destinationUrl: string | null;
  jevAssessment: JevAssessment | null;
}

export interface ResolvedCampaignData {
  campaign: {
    id: string;
    tenantId: string;
    networkProfile: NetworkProfile;
    status: string;
    primaryDestinationId: string;
    alternativeDestinationId: string;
  };
  primaryDest: { id: string; url: string };
  altDest: { id: string; url: string };
}

let activeAdapter: JevAdapter | null = null;

export function setJevAdapter(adapter: JevAdapter): void {
  activeAdapter = adapter;
}

export function getJevAdapter(): JevAdapter | null {
  return activeAdapter;
}

function makeDecision(
  action: RoutingDecision['action'],
  source: RoutingDecision['source'],
  reasonCode: RoutingDecision['reasonCode'],
  networkProfile: NetworkProfile,
  destinationId: string | null,
  botIdentity: string | null,
  networkEvidenceVersion: string | null,
  startTime: number,
): RoutingDecision {
  return {
    action,
    destinationId,
    botIdentity,
    source,
    reasonCode,
    policyVersion: POLICY_VERSION,
    networkProfile,
    profileVersion: PROFILE_VERSION,
    networkEvidenceVersion,
    featureVersion: FEATURE_VERSION,
    decisionId: randomUUID(),
    durationMs: Date.now() - startTime,
  };
}

function detectSuspiciousHeaders(headers: Record<string, string | undefined>): boolean {
  const ua = headers['user-agent'];
  if (!ua || ua.length < 10) return true;
  return false;
}

function detectMissingExpectedHeaders(headers: Record<string, string | undefined>): boolean {
  return !headers['accept'] && !headers['accept-language'];
}

async function recordEvent(
  decision: RoutingDecision,
  tenantId: string,
  campaignId: string,
  evidence: NetworkEvidence,
  jevAssessment: JevAssessment | null,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(decisionEvents).values({
      tenantId,
      campaignId,
      decisionId: decision.decisionId,
      action: decision.action,
      destinationId: decision.destinationId,
      source: decision.source,
      reasonCode: decision.reasonCode,
      networkProfile: decision.networkProfile,
      policyVersion: decision.policyVersion,
      profileVersion: decision.profileVersion,
      featureVersion: decision.featureVersion,
      networkEvidenceStatus: evidence.status,
      networkEvidenceVersion: evidence.sourceVersion,
      botIdentity: decision.botIdentity,
      jevAssessment: jevAssessment?.assessment ?? null,
      jevConfidence: jevAssessment?.confidence ?? null,
      jevModelVersion: jevAssessment?.modelVersion ?? null,
      jevInputTokens: jevAssessment?.inputTokens ?? null,
      durationMs: decision.durationMs,
    });
  } catch (err) {
    console.error('[pipeline] Failed to record decision event:', err);
  }
}

export async function executePipelineWithData(
  input: PipelineInput,
  data: ResolvedCampaignData,
  evidence: NetworkEvidence,
  adapter: JevAdapter | null,
  options?: { skipBudget?: boolean; skipEventRecording?: boolean },
): Promise<PipelineResult> {
  const startTime = Date.now();
  const { campaign, primaryDest, altDest } = data;
  const networkProfile = campaign.networkProfile;
  const evidenceVersion = evidence.sourceVersion;

  const rateResult = checkRateLimit(campaign.tenantId);
  if (!rateResult.allowed) {
    const decision = makeDecision('deny', 'rule', 'RATE_LIMIT', networkProfile, null, null, null, startTime);
    recordRequest(campaign.tenantId);
    return { decision, destinationUrl: null, jevAssessment: null };
  }
  recordRequest(campaign.tenantId);

  const suspiciousHeaders = detectSuspiciousHeaders(input.headers);
  const missingExpectedHeaders = detectMissingExpectedHeaders(input.headers);

  if (suspiciousHeaders && missingExpectedHeaders) {
    const decision = makeDecision('route_alternative', 'rule', 'RULE_ABUSE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  if (evidence.status === 'verified_bot' && evidence.botIdentity && !evidence.stale) {
    const decision = makeDecision(
      'route_alternative', 'rule', 'VERIFIED_BOT_ALTERNATIVE',
      networkProfile, altDest.id, evidence.botIdentity, evidenceVersion, startTime,
    );
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  if (!adapter) {
    const decision = makeDecision('route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  if (!jevCircuitBreaker.canExecute()) {
    const decision = makeDecision('route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  if (!options?.skipBudget) {
    const budgetResult = await reserveBudget(campaign.tenantId);
    if (!budgetResult.reserved) {
      const decision = makeDecision('route_alternative', 'fallback', 'BUDGET_EXHAUSTED', networkProfile, altDest.id, null, evidenceVersion, startTime);
      return { decision, destinationUrl: altDest.url, jevAssessment: null };
    }
  }

  let jevAssessment: JevAssessment | null = null;
  try {
    jevAssessment = await adapter.assess({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      networkProfile,
      policyVersion: POLICY_VERSION,
      profileVersion: PROFILE_VERSION,
      networkEvidence: evidence,
      sessionIntegrity: { hasValidSession: false, challengeCompleted: false, sessionAgeMs: null },
      frequencyCounters: { requestsLastMinute: 0, requestsLastHour: 0, uniqueCampaignsLastHour: 0 },
      abuseSignals: { rateLimitHit: false, suspiciousHeaders, missingExpectedHeaders },
    });
    jevCircuitBreaker.recordSuccess();
  } catch {
    jevCircuitBreaker.recordFailure();
    const decision = makeDecision('route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  const decision = applyPolicy(jevAssessment, networkProfile, primaryDest.id, altDest.id, evidenceVersion, startTime);
  const destinationUrl =
    decision.action === 'route_primary' ? primaryDest.url :
    decision.action === 'route_alternative' ? altDest.url :
    null;

  return { decision, destinationUrl, jevAssessment };
}

export async function executePipeline(input: PipelineInput): Promise<PipelineResult> {
  const startTime = Date.now();
  const db = getDb();

  // Step 1: Resolve campaign
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.slug, input.slug));

  if (!campaign) {
    const decision = makeDecision('deny', 'rule', 'CAMPAIGN_INVALID', 'general', null, null, null, startTime);
    return { decision, destinationUrl: null, jevAssessment: null };
  }

  if (campaign.status !== 'active') {
    const decision = makeDecision('deny', 'rule', 'CAMPAIGN_INVALID', campaign.networkProfile, null, null, null, startTime);
    return { decision, destinationUrl: null, jevAssessment: null };
  }

  // Load destinations
  const [primaryDest, altDest] = await Promise.all([
    db.select().from(destinations).where(eq(destinations.id, campaign.primaryDestinationId)).then((r) => r[0]),
    db.select().from(destinations).where(eq(destinations.id, campaign.alternativeDestinationId)).then((r) => r[0]),
  ]);

  if (!primaryDest || !altDest) {
    const decision = makeDecision('deny', 'rule', 'DESTINATION_INVALID', campaign.networkProfile, null, null, null, startTime);
    return { decision, destinationUrl: null, jevAssessment: null };
  }

  const networkProfile = campaign.networkProfile;

  // Step 2: Rate limiting (mandatory rules before anything else)
  const rateResult = checkRateLimit(campaign.tenantId);
  if (!rateResult.allowed) {
    const decision = makeDecision('deny', 'rule', 'RATE_LIMIT', networkProfile, null, null, null, startTime);
    recordRequest(campaign.tenantId);
    void recordEvent(decision, campaign.tenantId, campaign.id, { status: 'unavailable', asn: null, organization: null, botIdentity: null, stale: false, sourceId: null, sourceVersion: null, fetchedAt: null, expiresAt: null, verificationMethod: null, verifiedAt: null }, null);
    return { decision, destinationUrl: null, jevAssessment: null };
  }

  recordRequest(campaign.tenantId);

  // Step 3: Collect evidence
  const clientIp = extractClientIp(input.peerIp, input.headers, input.trustedProxies);
  const evidence = await collectEvidence(clientIp, input.userAgent);
  const evidenceVersion = evidence.sourceVersion;

  // Abuse signal detection
  const suspiciousHeaders = detectSuspiciousHeaders(input.headers);
  const missingExpectedHeaders = detectMissingExpectedHeaders(input.headers);

  if (suspiciousHeaders && missingExpectedHeaders) {
    // Confirmed abuse pattern: no UA + no accept headers
    const decision = makeDecision('route_alternative', 'rule', 'RULE_ABUSE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    void recordEvent(decision, campaign.tenantId, campaign.id, evidence, null);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  // Step 4: Bot identity — verified bot goes to alternative without Jev
  if (evidence.status === 'verified_bot' && evidence.botIdentity && !evidence.stale) {
    const decision = makeDecision(
      'route_alternative', 'rule', 'VERIFIED_BOT_ALTERNATIVE',
      networkProfile, altDest.id, evidence.botIdentity, evidenceVersion, startTime,
    );
    void recordEvent(decision, campaign.tenantId, campaign.id, evidence, null);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  // Step 5: Jev assessment for eligible decisions
  const adapter = activeAdapter;
  if (!adapter) {
    // No adapter configured — fallback to alternative
    const decision = makeDecision('route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    void recordEvent(decision, campaign.tenantId, campaign.id, evidence, null);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  // Circuit breaker check
  if (!jevCircuitBreaker.canExecute()) {
    const decision = makeDecision('route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    void recordEvent(decision, campaign.tenantId, campaign.id, evidence, null);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  // Budget reservation
  const budgetResult = await reserveBudget(campaign.tenantId);
  if (!budgetResult.reserved) {
    const decision = makeDecision('route_alternative', 'fallback', 'BUDGET_EXHAUSTED', networkProfile, altDest.id, null, evidenceVersion, startTime);
    void recordEvent(decision, campaign.tenantId, campaign.id, evidence, null);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  // Build Jev request context
  const jevContext: JevRequestContext = {
    tenantId: campaign.tenantId,
    campaignId: campaign.id,
    networkProfile,
    policyVersion: POLICY_VERSION,
    profileVersion: PROFILE_VERSION,
    networkEvidence: evidence,
    sessionIntegrity: {
      hasValidSession: false,
      challengeCompleted: false,
      sessionAgeMs: null,
    },
    frequencyCounters: {
      requestsLastMinute: 0,
      requestsLastHour: 0,
      uniqueCampaignsLastHour: 0,
    },
    abuseSignals: {
      rateLimitHit: false,
      suspiciousHeaders,
      missingExpectedHeaders,
    },
  };

  let jevAssessment: JevAssessment | null = null;

  try {
    jevAssessment = await adapter.assess(jevContext);
    jevCircuitBreaker.recordSuccess();
    await reconcileBudget(budgetResult.reservationId!, jevAssessment.inputTokens);
  } catch (err) {
    jevCircuitBreaker.recordFailure();
    await releaseBudget(budgetResult.reservationId!);

    // Fallback: failure NEVER liberates primary
    const decision = makeDecision('route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE', networkProfile, altDest.id, null, evidenceVersion, startTime);
    void recordEvent(decision, campaign.tenantId, campaign.id, evidence, null);
    return { decision, destinationUrl: altDest.url, jevAssessment: null };
  }

  // Step 6: Apply policy based on Jev assessment
  const decision = applyPolicy(
    jevAssessment,
    networkProfile,
    primaryDest.id,
    altDest.id,
    evidenceVersion,
    startTime,
  );

  void recordEvent(decision, campaign.tenantId, campaign.id, evidence, jevAssessment);

  const destinationUrl =
    decision.action === 'route_primary' ? primaryDest.url :
    decision.action === 'route_alternative' ? altDest.url :
    null;

  return { decision, destinationUrl, jevAssessment };
}

export function applyPolicy(
  assessment: JevAssessment,
  networkProfile: NetworkProfile,
  primaryDestId: string,
  altDestId: string,
  evidenceVersion: string | null,
  startTime: number,
): RoutingDecision {
  switch (assessment.assessment) {
    case 'likely_human':
      return makeDecision(
        'route_primary', 'jev', 'JEV_HUMAN_PRIMARY',
        networkProfile, primaryDestId, null, evidenceVersion, startTime,
      );

    case 'likely_automation':
      return makeDecision(
        'route_alternative', 'jev', 'JEV_AUTOMATION_ALTERNATIVE',
        networkProfile, altDestId, null, evidenceVersion, startTime,
      );

    case 'insufficient_evidence':
      // Challenge not yet implemented; fallback to alternative with reason
      return makeDecision(
        'route_alternative', 'jev', 'LOW_EVIDENCE_CHALLENGE',
        networkProfile, altDestId, null, evidenceVersion, startTime,
      );

    default:
      return makeDecision(
        'route_alternative', 'fallback', 'ENGINE_FAILURE_ALTERNATIVE',
        networkProfile, altDestId, null, evidenceVersion, startTime,
      );
  }
}
