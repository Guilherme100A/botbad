import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import {
  createMockNetworkEvidence,
  createVerifiedBotEvidence,
  createMockJevAssessment,
  SIMULATION_SCENARIOS,
} from '@botbad/contracts';
import type { JevAdapter, JevRequestContext, JevAssessment, Assessment } from '@botbad/contracts';
import { campaigns, destinations } from '@botbad/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { executePipelineWithData, type ResolvedCampaignData } from './pipeline.js';

const simulateRoutes = new Hono();

simulateRoutes.use('*', authMiddleware);

const scenarioInput = z.object({
  scenario: z.enum(['likely_human', 'verified_bot', 'likely_automation', 'insufficient_evidence']),
});

class SimulationAdapter implements JevAdapter {
  constructor(private readonly targetAssessment: Assessment) {}

  async assess(_context: JevRequestContext): Promise<JevAssessment> {
    return createMockJevAssessment(this.targetAssessment);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

simulateRoutes.post('/:id/simulate', async (c) => {
  const auth = c.get('auth');
  const db = getDb();
  const campaignId = c.req.param('id');

  const body = await c.req.json();
  const parsed = scenarioInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid scenario', details: parsed.error.flatten() },
      400,
    );
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, auth.tenantId)));

  if (!campaign) {
    return c.json({ code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' }, 404);
  }

  const [primaryDest, altDest] = await Promise.all([
    db.select().from(destinations).where(eq(destinations.id, campaign.primaryDestinationId)).then((r) => r[0]),
    db.select().from(destinations).where(eq(destinations.id, campaign.alternativeDestinationId)).then((r) => r[0]),
  ]);

  if (!primaryDest || !altDest) {
    return c.json({ code: 'DESTINATION_INVALID', message: 'Campaign destinations not configured' }, 400);
  }

  const scenarioName = parsed.data.scenario;
  const scenarioDef = SIMULATION_SCENARIOS.find((s) => s.name === scenarioName);

  const evidence = scenarioDef
    ? scenarioDef.evidence
    : createMockNetworkEvidence();

  const adapter: JevAdapter | null = scenarioName === 'verified_bot'
    ? null
    : new SimulationAdapter(
        scenarioName === 'likely_human' ? 'likely_human' :
        scenarioName === 'likely_automation' ? 'likely_automation' :
        'insufficient_evidence',
      );

  const data: ResolvedCampaignData = {
    campaign: {
      id: campaign.id,
      tenantId: campaign.tenantId,
      networkProfile: campaign.networkProfile,
      status: 'active',
      primaryDestinationId: campaign.primaryDestinationId,
      alternativeDestinationId: campaign.alternativeDestinationId,
    },
    primaryDest: { id: primaryDest.id, url: primaryDest.url },
    altDest: { id: altDest.id, url: altDest.url },
  };

  const input = {
    slug: campaign.slug ?? 'simulation',
    peerIp: '198.51.100.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'accept': 'text/html',
      'accept-language': 'en-US',
    } as Record<string, string | undefined>,
  };

  const result = await executePipelineWithData(input, data, evidence, adapter, {
    skipBudget: true,
    skipEventRecording: true,
  });

  return c.json({
    simulation: true,
    scenario: scenarioName,
    scenarioDescription: scenarioDef?.description ?? null,
    decision: {
      action: result.decision.action,
      destinationId: result.decision.destinationId,
      source: result.decision.source,
      reasonCode: result.decision.reasonCode,
      botIdentity: result.decision.botIdentity,
    },
    destinationUrl: result.destinationUrl,
    jevAssessment: result.jevAssessment
      ? {
          assessment: result.jevAssessment.assessment,
          confidence: result.jevAssessment.confidence,
        }
      : null,
    expectedAction: scenarioDef?.expectedAction ?? null,
    expectedReasonCode: scenarioDef?.expectedReasonCode ?? null,
  });
});

export { simulateRoutes };
