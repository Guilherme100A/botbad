import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockNetworkEvidence,
  createVerifiedBotEvidence,
  createNetworkAssociationEvidence,
  FIXTURE_TENANT,
  FIXTURE_DESTINATIONS,
} from '@botbad/contracts';
import type { JevAdapter, JevRequestContext, NetworkEvidence } from '@botbad/contracts';
import { JevOpenRouterAdapter } from '../../apps/api/src/adapters/jev-openrouter.js';
import {
  executePipelineWithData,
  applyPolicy,
  setJevAdapter,
  type ResolvedCampaignData,
  type PipelineInput,
} from '../../apps/api/src/decision/pipeline.js';
import { jevCircuitBreaker } from '../../apps/api/src/decision/circuit-breaker.js';

const API_KEY = process.env['OPENROUTER_API_KEY'] ?? '';

function makeContext(evidence: NetworkEvidence, overrides?: Partial<JevRequestContext>): JevRequestContext {
  return {
    tenantId: FIXTURE_TENANT.id,
    campaignId: 'test-campaign-001',
    networkProfile: 'general',
    policyVersion: '1.0.0',
    profileVersion: '1.0.0',
    networkEvidence: evidence,
    sessionIntegrity: { hasValidSession: false, challengeCompleted: false, sessionAgeMs: null },
    frequencyCounters: { requestsLastMinute: 0, requestsLastHour: 0, uniqueCampaignsLastHour: 0 },
    abuseSignals: { rateLimitHit: false, suspiciousHeaders: false, missingExpectedHeaders: false },
    ...overrides,
  };
}

const campaignData: ResolvedCampaignData = {
  campaign: {
    id: 'test-campaign-001',
    tenantId: FIXTURE_TENANT.id,
    networkProfile: 'general',
    status: 'active',
    primaryDestinationId: FIXTURE_DESTINATIONS.primary.id,
    alternativeDestinationId: FIXTURE_DESTINATIONS.alternative.id,
  },
  primaryDest: { id: FIXTURE_DESTINATIONS.primary.id, url: FIXTURE_DESTINATIONS.primary.url },
  altDest: { id: FIXTURE_DESTINATIONS.alternative.id, url: FIXTURE_DESTINATIONS.alternative.url },
};

const defaultInput: PipelineInput = {
  slug: 'test',
  peerIp: '203.0.113.50',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml',
    'accept-language': 'en-US,en;q=0.9',
  },
};

describe('OpenRouter Jev Adapter — direct calls', { skip: !API_KEY ? 'OPENROUTER_API_KEY not set' : false }, () => {
  let adapter: JevOpenRouterAdapter;

  before(() => {
    adapter = new JevOpenRouterAdapter(API_KEY);
  });

  it('healthCheck returns true with valid key', async () => {
    const ok = await adapter.healthCheck();
    assert.equal(ok, true, 'healthCheck should return true');
  });

  it('classifies normal human visitor as likely_human', async () => {
    const evidence = createMockNetworkEvidence({ status: 'unknown' });
    const ctx = makeContext(evidence);
    const result = await adapter.assess(ctx);

    console.log('  [human] assessment:', result.assessment, 'confidence:', result.confidence);
    console.log('  [human] probabilities:', result.probabilities);

    assert.ok(['likely_human', 'insufficient_evidence'].includes(result.assessment),
      `Expected likely_human or insufficient_evidence, got ${result.assessment}`);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(result.probabilities.likely_human >= 0);
    assert.ok(result.probabilities.likely_automation >= 0);
    const sum = result.probabilities.likely_human + result.probabilities.likely_automation + result.probabilities.insufficient_evidence;
    assert.ok(Math.abs(sum - 1) <= 0.05, `Probabilities sum ${sum} should be ~1`);
  });

  it('classifies high-frequency abuser as likely_automation', async () => {
    const evidence = createNetworkAssociationEvidence(16509, 'Amazon.com Inc. (AWS)');
    const ctx = makeContext(evidence, {
      frequencyCounters: { requestsLastMinute: 120, requestsLastHour: 3000, uniqueCampaignsLastHour: 50 },
      abuseSignals: { rateLimitHit: true, suspiciousHeaders: true, missingExpectedHeaders: true },
    });
    const result = await adapter.assess(ctx);

    console.log('  [automation] assessment:', result.assessment, 'confidence:', result.confidence);
    console.log('  [automation] probabilities:', result.probabilities);

    assert.ok(['likely_automation', 'insufficient_evidence'].includes(result.assessment),
      `Expected likely_automation or insufficient_evidence, got ${result.assessment}`);
    assert.ok(result.probabilities.likely_automation > result.probabilities.likely_human,
      'Automation probability should be higher than human for abusive traffic');
  });

  it('classifies ambiguous visitor as insufficient_evidence', async () => {
    const evidence = createMockNetworkEvidence({ status: 'unavailable' });
    const ctx = makeContext(evidence, {
      sessionIntegrity: { hasValidSession: false, challengeCompleted: false, sessionAgeMs: null },
    });
    const result = await adapter.assess(ctx);

    console.log('  [ambiguous] assessment:', result.assessment, 'confidence:', result.confidence);
    console.log('  [ambiguous] probabilities:', result.probabilities);

    assert.ok(['likely_human', 'insufficient_evidence'].includes(result.assessment),
      `Expected insufficient_evidence or likely_human, got ${result.assessment}`);
  });

  it('classifies datacenter IP with session as nuanced (not auto-bot)', async () => {
    const evidence = createNetworkAssociationEvidence(14618, 'Google LLC');
    const ctx = makeContext(evidence, {
      sessionIntegrity: { hasValidSession: true, challengeCompleted: true, sessionAgeMs: 120_000 },
      frequencyCounters: { requestsLastMinute: 2, requestsLastHour: 15, uniqueCampaignsLastHour: 1 },
      abuseSignals: { rateLimitHit: false, suspiciousHeaders: false, missingExpectedHeaders: false },
    });
    const result = await adapter.assess(ctx);

    console.log('  [datacenter+session] assessment:', result.assessment, 'confidence:', result.confidence);
    console.log('  [datacenter+session] probabilities:', result.probabilities);

    assert.ok(result.assessment !== undefined);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });
});

describe('Full pipeline with OpenRouter adapter', { skip: !API_KEY ? 'OPENROUTER_API_KEY not set' : false }, () => {
  let adapter: JevOpenRouterAdapter;

  before(() => {
    adapter = new JevOpenRouterAdapter(API_KEY);
    setJevAdapter(adapter);
    jevCircuitBreaker.resetForTesting();
  });

  it('verified bot bypasses LLM entirely → route_alternative', async () => {
    const evidence = createVerifiedBotEvidence('googlebot');
    const result = await executePipelineWithData(defaultInput, campaignData, evidence, adapter, { skipBudget: true, skipEventRecording: true });

    console.log('  [verified-bot] action:', result.decision.action, 'reason:', result.decision.reasonCode);

    assert.equal(result.decision.action, 'route_alternative');
    assert.equal(result.decision.reasonCode, 'VERIFIED_BOT_ALTERNATIVE');
    assert.equal(result.decision.source, 'rule');
    assert.equal(result.jevAssessment, null, 'Jev should NOT be called for verified bots');
    assert.equal(result.destinationUrl, FIXTURE_DESTINATIONS.alternative.url);
  });

  it('normal visitor goes through LLM → route_primary or challenge', async () => {
    const evidence = createMockNetworkEvidence({ status: 'unknown' });
    const result = await executePipelineWithData(defaultInput, campaignData, evidence, adapter, { skipBudget: true, skipEventRecording: true });

    console.log('  [normal] action:', result.decision.action, 'reason:', result.decision.reasonCode);
    console.log('  [normal] jev assessment:', result.jevAssessment?.assessment, 'confidence:', result.jevAssessment?.confidence);

    assert.notEqual(result.jevAssessment, null, 'Jev should have been called');
    assert.ok(['route_primary', 'route_alternative'].includes(result.decision.action));
    assert.ok(['JEV_HUMAN_PRIMARY', 'JEV_AUTOMATION_ALTERNATIVE', 'LOW_EVIDENCE_CHALLENGE'].includes(result.decision.reasonCode));
    assert.equal(result.decision.source, 'jev');
  });

  it('abusive traffic pattern → route_alternative by rule (no LLM call)', async () => {
    const evidence = createMockNetworkEvidence();
    const abuseInput: PipelineInput = {
      slug: 'test',
      peerIp: '198.51.100.1',
      userAgent: '',
      headers: {},
    };
    const result = await executePipelineWithData(abuseInput, campaignData, evidence, adapter, { skipBudget: true, skipEventRecording: true });

    console.log('  [abuse] action:', result.decision.action, 'reason:', result.decision.reasonCode);

    assert.equal(result.decision.action, 'route_alternative');
    assert.equal(result.decision.reasonCode, 'RULE_ABUSE');
    assert.equal(result.decision.source, 'rule');
    assert.equal(result.jevAssessment, null, 'Jev should NOT be called for abuse patterns');
  });

  it('circuit breaker open → fallback without LLM call', async () => {
    jevCircuitBreaker.resetForTesting();
    for (let i = 0; i < 5; i++) jevCircuitBreaker.recordFailure();

    const evidence = createMockNetworkEvidence();
    const result = await executePipelineWithData(defaultInput, campaignData, evidence, adapter, { skipBudget: true, skipEventRecording: true });

    console.log('  [cb-open] action:', result.decision.action, 'reason:', result.decision.reasonCode);

    assert.equal(result.decision.action, 'route_alternative');
    assert.equal(result.decision.reasonCode, 'ENGINE_FAILURE_ALTERNATIVE');
    assert.equal(result.decision.source, 'fallback');

    jevCircuitBreaker.resetForTesting();
  });

  it('INVARIANT: adapter failure → NEVER routes to primary', async () => {
    const failAdapter: JevAdapter = {
      assess: () => Promise.reject(new Error('Simulated LLM failure')),
      healthCheck: () => Promise.resolve(false),
    };

    const evidence = createMockNetworkEvidence();
    const result = await executePipelineWithData(defaultInput, campaignData, evidence, failAdapter, { skipBudget: true, skipEventRecording: true });

    console.log('  [invariant] action:', result.decision.action, 'reason:', result.decision.reasonCode);

    assert.notEqual(result.decision.action, 'route_primary', 'FAILURE MUST NEVER LIBERATE TO PRIMARY');
    assert.equal(result.decision.action, 'route_alternative');
    assert.equal(result.decision.reasonCode, 'ENGINE_FAILURE_ALTERNATIVE');
  });
});

describe('Policy consistency — LLM assessment → routing', { skip: !API_KEY ? 'OPENROUTER_API_KEY not set' : false }, () => {
  let adapter: JevOpenRouterAdapter;

  before(() => {
    adapter = new JevOpenRouterAdapter(API_KEY);
  });

  it('applyPolicy routes correctly for each LLM assessment type', async () => {
    const scenarios = [
      { evidence: createMockNetworkEvidence(), label: 'unknown-ip' },
      { evidence: createNetworkAssociationEvidence(16509, 'Amazon AWS'), label: 'aws-ip' },
      { evidence: createMockNetworkEvidence({ status: 'unavailable' }), label: 'unavailable' },
    ];

    for (const { evidence, label } of scenarios) {
      const ctx = makeContext(evidence);
      const assessment = await adapter.assess(ctx);
      const decision = applyPolicy(
        assessment, 'general',
        FIXTURE_DESTINATIONS.primary.id,
        FIXTURE_DESTINATIONS.alternative.id,
        null, Date.now(),
      );

      console.log(`  [policy:${label}] assessment=${assessment.assessment} → action=${decision.action} reason=${decision.reasonCode}`);

      if (assessment.assessment === 'likely_human') {
        assert.equal(decision.action, 'route_primary');
        assert.equal(decision.reasonCode, 'JEV_HUMAN_PRIMARY');
      } else if (assessment.assessment === 'likely_automation') {
        assert.equal(decision.action, 'route_alternative');
        assert.equal(decision.reasonCode, 'JEV_AUTOMATION_ALTERNATIVE');
      } else {
        assert.equal(decision.action, 'route_alternative');
        assert.equal(decision.reasonCode, 'LOW_EVIDENCE_CHALLENGE');
      }
    }
  });
});
