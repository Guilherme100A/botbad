import type { JevAdapter, JevRequestContext } from '@botbad/contracts';
import type { JevAssessment } from '@botbad/contracts';

export class JevMockAdapter implements JevAdapter {
  async assess(context: JevRequestContext): Promise<JevAssessment> {
    return {
      assessment: 'likely_human',
      probabilities: {
        likely_human: 0.85,
        likely_automation: 0.10,
        insufficient_evidence: 0.05,
      },
      confidence: 0.85,
      modelVersion: 'mock-1.0.0',
      inputTokens: 0,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
