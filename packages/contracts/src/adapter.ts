import type { NetworkEvidence, NetworkProfile } from './network.js';
import type { JevAssessment } from './assessment.js';

export interface JevRequestContext {
  tenantId: string;
  campaignId: string;
  networkProfile: NetworkProfile;
  policyVersion: string;
  profileVersion: string;
  networkEvidence: NetworkEvidence;
  sessionIntegrity: SessionIntegrity;
  frequencyCounters: FrequencyCounters;
  abuseSignals: AbuseSignals;
}

export interface SessionIntegrity {
  hasValidSession: boolean;
  challengeCompleted: boolean;
  sessionAgeMs: number | null;
}

export interface FrequencyCounters {
  requestsLastMinute: number;
  requestsLastHour: number;
  uniqueCampaignsLastHour: number;
}

export interface AbuseSignals {
  rateLimitHit: boolean;
  suspiciousHeaders: boolean;
  missingExpectedHeaders: boolean;
}

export interface JevAdapter {
  assess(context: JevRequestContext): Promise<JevAssessment>;
  healthCheck(): Promise<boolean>;
}
