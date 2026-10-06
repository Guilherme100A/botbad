import { z } from 'zod';
import { RoutingActionSchema, DecisionSourceSchema, ReasonCodeSchema } from './routing.js';
import { NetworkProfileSchema, NetworkEvidenceStatusSchema } from './network.js';
import { AssessmentSchema } from './assessment.js';

export const DecisionEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  campaignId: z.string().uuid(),
  decisionId: z.string().uuid(),
  action: RoutingActionSchema,
  destinationId: z.string().uuid().nullable(),
  source: DecisionSourceSchema,
  reasonCode: ReasonCodeSchema,
  networkProfile: NetworkProfileSchema,
  policyVersion: z.string(),
  profileVersion: z.string(),
  featureVersion: z.string(),
  networkEvidenceStatus: NetworkEvidenceStatusSchema.nullable(),
  networkEvidenceVersion: z.string().nullable(),
  botIdentity: z.string().nullable(),
  jevAssessment: AssessmentSchema.nullable(),
  jevConfidence: z.number().min(0).max(1).nullable(),
  jevModelVersion: z.string().nullable(),
  jevInputTokens: z.number().int().nonnegative().nullable(),
  durationMs: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type DecisionEvent = z.infer<typeof DecisionEventSchema>;
