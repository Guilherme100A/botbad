import { z } from 'zod';
import { NetworkProfileSchema } from './network.js';

export const RoutingActionSchema = z.enum([
  'route_primary',
  'route_alternative',
  'challenge',
  'deny',
]);
export type RoutingAction = z.infer<typeof RoutingActionSchema>;

export const DecisionSourceSchema = z.enum([
  'rule',
  'cache',
  'jev',
  'fallback',
]);
export type DecisionSource = z.infer<typeof DecisionSourceSchema>;

export const ReasonCode = {
  VERIFIED_BOT_ALTERNATIVE: 'VERIFIED_BOT_ALTERNATIVE',
  JEV_AUTOMATION_ALTERNATIVE: 'JEV_AUTOMATION_ALTERNATIVE',
  JEV_HUMAN_PRIMARY: 'JEV_HUMAN_PRIMARY',
  LOW_EVIDENCE_CHALLENGE: 'LOW_EVIDENCE_CHALLENGE',
  ENGINE_FAILURE_ALTERNATIVE: 'ENGINE_FAILURE_ALTERNATIVE',
  RATE_LIMIT: 'RATE_LIMIT',
  RULE_ABUSE: 'RULE_ABUSE',
  CAMPAIGN_INVALID: 'CAMPAIGN_INVALID',
  DESTINATION_INVALID: 'DESTINATION_INVALID',
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
  CHALLENGE_APPROVED: 'CHALLENGE_APPROVED',
  CHALLENGE_FAILED: 'CHALLENGE_FAILED',
} as const;

export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

export const ReasonCodeSchema = z.enum([
  'VERIFIED_BOT_ALTERNATIVE',
  'JEV_AUTOMATION_ALTERNATIVE',
  'JEV_HUMAN_PRIMARY',
  'LOW_EVIDENCE_CHALLENGE',
  'ENGINE_FAILURE_ALTERNATIVE',
  'RATE_LIMIT',
  'RULE_ABUSE',
  'CAMPAIGN_INVALID',
  'DESTINATION_INVALID',
  'BUDGET_EXHAUSTED',
  'CHALLENGE_APPROVED',
  'CHALLENGE_FAILED',
]);

export const RoutingDecisionSchema = z.object({
  action: RoutingActionSchema,
  destinationId: z.string().uuid().nullable(),
  botIdentity: z.string().nullable(),
  source: DecisionSourceSchema,
  reasonCode: ReasonCodeSchema,
  policyVersion: z.string().min(1),
  networkProfile: NetworkProfileSchema,
  profileVersion: z.string().min(1),
  networkEvidenceVersion: z.string().nullable(),
  featureVersion: z.string().min(1),
  decisionId: z.string().uuid(),
  durationMs: z.number().nonnegative(),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;
