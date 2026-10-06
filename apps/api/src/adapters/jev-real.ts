import type { JevAdapter, JevRequestContext } from '@botbad/contracts';
import type { JevAssessment, Assessment } from '@botbad/contracts';

const JEV_API_URL = 'https://api.typesafe.ai/v1/systemone';
const JEV_MODEL = 'jev-1.13.0';
const JEV_TIMEOUT_MS = 600;

function buildState(context: JevRequestContext): Record<string, unknown> {
  return {
    network_evidence: {
      status: context.networkEvidence.status,
      asn: context.networkEvidence.asn,
      organization: context.networkEvidence.organization,
      stale: context.networkEvidence.stale,
      source_id: context.networkEvidence.sourceId,
      source_version: context.networkEvidence.sourceVersion,
      fetched_at: context.networkEvidence.fetchedAt,
      expires_at: context.networkEvidence.expiresAt,
      verification_method: context.networkEvidence.verificationMethod,
      verified_at: context.networkEvidence.verifiedAt,
    },
    session: {
      has_valid_session: context.sessionIntegrity.hasValidSession,
      challenge_completed: context.sessionIntegrity.challengeCompleted,
      session_age_ms: context.sessionIntegrity.sessionAgeMs,
    },
    frequency: {
      requests_last_minute: context.frequencyCounters.requestsLastMinute,
      requests_last_hour: context.frequencyCounters.requestsLastHour,
      unique_campaigns_last_hour: context.frequencyCounters.uniqueCampaignsLastHour,
    },
    abuse_signals: {
      rate_limit_hit: context.abuseSignals.rateLimitHit,
      suspicious_headers: context.abuseSignals.suspiciousHeaders,
      missing_expected_headers: context.abuseSignals.missingExpectedHeaders,
    },
    policy: {
      network_profile: context.networkProfile,
      policy_version: context.policyVersion,
      profile_version: context.profileVersion,
    },
  };
}

function buildQuestions(): Array<Record<string, unknown>> {
  return [
    {
      type: 'choice',
      id: 'visitor_classification',
      instructions: [
        'Classify this visitor based on the evidence provided.',
        'You are evaluating a single HTTP request to a protected page.',
        'The goal is to determine whether this visitor is a probable human client, probable automation, or if evidence is insufficient to classify.',
        '',
        'Evidence to consider:',
        '- Network evidence: ASN, organization, verification status, staleness',
        '- Session integrity: whether a valid session exists, challenge completion, session age',
        '- Frequency counters: request rate in the last minute and hour, unique campaigns accessed',
        '- Abuse signals: rate limit hits, suspicious or missing headers',
        '',
        'Important distinctions:',
        '- Network association with a company does NOT prove automation or bot identity',
        '- Missing evidence reduces coverage but does not automatically elevate risk',
        '- A VPN, datacenter IP, or unknown ASN alone does not determine the classification',
        '- Bot identity requires verified_bot status from DNS verification, not just ASN match',
        '- Absence of session or cookies on first visit is expected for new human visitors',
      ].join('\n'),
      criteria: {
        likely_human: [
          'Visitor shows characteristics consistent with a human browser session.',
          'No strong indicators of automation.',
          'Network evidence does not indicate verified bot.',
          'Request frequency is within normal human browsing patterns.',
          'Headers are consistent with a standard browser.',
          'Counterexample: high request frequency, missing standard browser headers, or verified bot status would contradict this classification.',
        ].join('\n'),
        likely_automation: [
          'Visitor shows strong indicators of automated access.',
          'Multiple abuse signals are present, or frequency patterns are clearly non-human.',
          'Missing expected browser headers combined with high request rate.',
          'Suspicious header patterns inconsistent with any known browser.',
          'Counterexample: a single unusual header without other indicators is insufficient. A datacenter IP alone does not prove automation.',
          'Note: network_association status does NOT confirm automation — it only indicates the IP belongs to a known organization.',
        ].join('\n'),
        insufficient_evidence: [
          'Available evidence is not sufficient to classify the visitor with confidence.',
          'Key signals are missing or contradictory.',
          'Network evidence is unavailable or stale.',
          'No session history exists and no strong abuse signals are present.',
          'This is the appropriate classification when in doubt — do not force a classification.',
        ].join('\n'),
      },
    },
  ];
}

const VALID_ASSESSMENTS = new Set<string>(['likely_human', 'likely_automation', 'insufficient_evidence']);

function validateResponse(data: unknown): JevAssessment {
  if (!data || typeof data !== 'object') {
    throw new Error('Jev response is not an object');
  }

  const resp = data as Record<string, unknown>;
  const answers = resp['answers'];
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error('Jev response missing answers array');
  }

  const answer = answers[0] as Record<string, unknown>;
  const choice = String(answer['choice'] ?? '');
  if (!VALID_ASSESSMENTS.has(choice)) {
    throw new Error(`Jev returned invalid assessment: ${choice}`);
  }

  const probabilities = answer['probabilities'] as Record<string, number> | undefined;
  if (!probabilities || typeof probabilities !== 'object') {
    throw new Error('Jev response missing probabilities');
  }

  const pHuman = Number(probabilities['likely_human']);
  const pAutomation = Number(probabilities['likely_automation']);
  const pInsufficient = Number(probabilities['insufficient_evidence']);

  if (!isFinite(pHuman) || pHuman < 0 || pHuman > 1) throw new Error('Invalid likely_human probability');
  if (!isFinite(pAutomation) || pAutomation < 0 || pAutomation > 1) throw new Error('Invalid likely_automation probability');
  if (!isFinite(pInsufficient) || pInsufficient < 0 || pInsufficient > 1) throw new Error('Invalid insufficient_evidence probability');

  const sum = pHuman + pAutomation + pInsufficient;
  if (Math.abs(sum - 1) > 0.01) {
    throw new Error(`Probabilities sum to ${sum}, expected ~1.0`);
  }

  const confidence = Number(answer['confidence'] ?? resp['confidence']);
  if (!isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Invalid confidence value');
  }

  const modelVersion = String(resp['model'] ?? resp['model_version'] ?? JEV_MODEL);
  const usage = resp['usage'] as Record<string, unknown> | undefined;
  const inputTokens = Number(usage?.['input_tokens'] ?? 0);

  return {
    assessment: choice as Assessment,
    probabilities: {
      likely_human: pHuman,
      likely_automation: pAutomation,
      insufficient_evidence: pInsufficient,
    },
    confidence,
    modelVersion,
    inputTokens: Math.max(0, Math.floor(inputTokens)),
  };
}

export class JevRealAdapter implements JevAdapter {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(
    apiKey?: string,
    apiUrl: string = JEV_API_URL,
    timeoutMs: number = JEV_TIMEOUT_MS,
  ) {
    this.apiKey = apiKey ?? process.env['JEV_API_KEY'] ?? '';
    this.apiUrl = apiUrl;
    this.timeoutMs = timeoutMs;
  }

  async assess(context: JevRequestContext): Promise<JevAssessment> {
    if (!this.apiKey) {
      throw new Error('JEV_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = JSON.stringify({
        model: JEV_MODEL,
        state: buildState(context),
        questions: buildQuestions(),
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new JevApiError('Jev rate limited', 429);
      }
      if (response.status === 401) {
        throw new JevApiError('Jev authentication failed', 401);
      }
      if (!response.ok) {
        throw new JevApiError(`Jev returned ${response.status}`, response.status);
      }

      const data = await response.json();
      return validateResponse(data);
    } catch (err) {
      if (err instanceof JevApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new JevTimeoutError();
      }
      throw new JevApiError(`Jev request failed: ${err instanceof Error ? err.message : 'unknown'}`, 0);
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.apiUrl, {
        method: 'HEAD',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response.status < 500;
    } catch {
      return false;
    }
  }
}

export class JevApiError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'JevApiError';
  }
}

export class JevTimeoutError extends Error {
  constructor() {
    super('Jev request timed out');
    this.name = 'JevTimeoutError';
  }
}
