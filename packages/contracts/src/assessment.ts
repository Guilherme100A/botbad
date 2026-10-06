import { z } from 'zod';

export const AssessmentSchema = z.enum([
  'likely_human',
  'likely_automation',
  'insufficient_evidence',
]);
export type Assessment = z.infer<typeof AssessmentSchema>;

export const JevAssessmentSchema = z.object({
  assessment: AssessmentSchema,
  probabilities: z.object({
    likely_human: z.number().min(0).max(1),
    likely_automation: z.number().min(0).max(1),
    insufficient_evidence: z.number().min(0).max(1),
  }).refine(
    (p) => Math.abs(p.likely_human + p.likely_automation + p.insufficient_evidence - 1) <= 0.01,
    { message: 'Probabilities must sum to 1 (±0.01)' },
  ),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
});
export type JevAssessment = z.infer<typeof JevAssessmentSchema>;
