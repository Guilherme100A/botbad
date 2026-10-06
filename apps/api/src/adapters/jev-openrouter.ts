import type { JevAdapter, JevRequestContext } from '@botbad/contracts';
import type { JevAssessment, Assessment } from '@botbad/contracts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'typesafe/jev-router';

const VALID_ASSESSMENTS = new Set<string>(['likely_human', 'likely_automation', 'insufficient_evidence']);

function buildSystemPrompt(): string {
  return [
    'You are a visitor classification engine for a traffic routing system.',
    'You analyze HTTP request evidence and classify the visitor as one of:',
    '- likely_human: visitor shows characteristics consistent with a human browser session',
    '- likely_automation: visitor shows strong indicators of automated access',
    '- insufficient_evidence: available evidence is not sufficient to classify with confidence',
    '',
    'IMPORTANT rules:',
    '- Network association with a company does NOT prove automation',
    '- Missing evidence reduces coverage but does not automatically elevate risk',
    '- A VPN, datacenter IP, or unknown ASN alone does not determine classification',
    '- Bot identity requires verified_bot status from DNS verification, not just ASN match',
    '- Absence of session or cookies on first visit is expected for new human visitors',
    '- When in doubt, classify as insufficient_evidence',
    '',
    'You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:',
    '{',
    '  "assessment": "likely_human" | "likely_automation" | "insufficient_evidence",',
    '  "probabilities": {',
    '    "likely_human": <0-1>,',
    '    "likely_automation": <0-1>,',
    '    "insufficient_evidence": <0-1>',
    '  },',
    '  "confidence": <0-1>',
    '}',
    'The three probabilities MUST sum to exactly 1.0.',
  ].join('\n');
}

function buildUserPrompt(context: JevRequestContext): string {
  return JSON.stringify({
    network_evidence: {
      status: context.networkEvidence.status,
      asn: context.networkEvidence.asn,
      organization: context.networkEvidence.organization,
      stale: context.networkEvidence.stale,
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
    },
  }, null, 2);
}

function parseResponse(text: string): JevAssessment {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in LLM response');

  const data = JSON.parse(jsonMatch[0]);

  const assessment = String(data.assessment ?? '');
  if (!VALID_ASSESSMENTS.has(assessment)) {
    throw new Error(`Invalid assessment: ${assessment}`);
  }

  const p = data.probabilities;
  if (!p || typeof p !== 'object') throw new Error('Missing probabilities');

  const pHuman = Number(p.likely_human);
  const pAutomation = Number(p.likely_automation);
  const pInsufficient = Number(p.insufficient_evidence);

  if (!isFinite(pHuman) || pHuman < 0 || pHuman > 1) throw new Error('Invalid likely_human probability');
  if (!isFinite(pAutomation) || pAutomation < 0 || pAutomation > 1) throw new Error('Invalid likely_automation probability');
  if (!isFinite(pInsufficient) || pInsufficient < 0 || pInsufficient > 1) throw new Error('Invalid insufficient_evidence probability');

  const sum = pHuman + pAutomation + pInsufficient;
  if (Math.abs(sum - 1) > 0.05) {
    throw new Error(`Probabilities sum to ${sum}, expected ~1.0`);
  }

  const confidence = Number(data.confidence);
  if (!isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Invalid confidence');
  }

  return {
    assessment: assessment as Assessment,
    probabilities: { likely_human: pHuman, likely_automation: pAutomation, insufficient_evidence: pInsufficient },
    confidence,
    modelVersion: 'openrouter-sim',
    inputTokens: 0,
  };
}

export class JevOpenRouterAdapter implements JevAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model: string = DEFAULT_MODEL, timeoutMs: number = 15_000) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async assess(context: JevRequestContext): Promise<JevAssessment> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://botbad.local',
          'X-Title': 'JEV Traffic Router Test',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: `Classify this visitor:\n${buildUserPrompt(context)}` },
          ],
          temperature: 0.1,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      return parseResponse(content);
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }
}
