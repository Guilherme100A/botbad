import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  real,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 255 }),
    /** scrypt$N$r$p$salt$hash (see apps/api/src/auth/password.ts) */
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  }),
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull().$type<'owner' | 'operator' | 'viewer'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUserIdx: uniqueIndex('memberships_tenant_user_idx').on(t.tenantId, t.userId),
  }),
);

export const destinations = pgTable(
  'destinations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    url: text('url').notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('destinations_tenant_idx').on(t.tenantId),
  }),
);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 128 }),
    primaryDestinationId: uuid('primary_destination_id')
      .notNull()
      .references(() => destinations.id),
    alternativeDestinationId: uuid('alternative_destination_id')
      .notNull()
      .references(() => destinations.id),
    networkProfile: varchar('network_profile', { length: 20 })
      .notNull()
      .default('general')
      .$type<'general' | 'tiktok' | 'meta' | 'google' | 'x' | 'organic' | 'custom'>(),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('draft')
      .$type<'draft' | 'active' | 'paused' | 'archived'>(),
    policyVersion: varchar('policy_version', { length: 50 }).notNull().default('1.0.0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('campaigns_tenant_idx').on(t.tenantId),
    slugIdx: uniqueIndex('campaigns_slug_idx').on(t.slug),
  }),
);

export const decisionEvents = pgTable(
  'decision_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    decisionId: uuid('decision_id').notNull(),
    action: varchar('action', { length: 30 }).notNull(),
    destinationId: uuid('destination_id'),
    source: varchar('source', { length: 20 }).notNull(),
    reasonCode: varchar('reason_code', { length: 50 }).notNull(),
    networkProfile: varchar('network_profile', { length: 20 }).notNull(),
    policyVersion: varchar('policy_version', { length: 50 }).notNull(),
    profileVersion: varchar('profile_version', { length: 50 }).notNull(),
    featureVersion: varchar('feature_version', { length: 50 }).notNull(),
    networkEvidenceStatus: varchar('network_evidence_status', { length: 30 }),
    networkEvidenceVersion: varchar('network_evidence_version', { length: 50 }),
    botIdentity: varchar('bot_identity', { length: 255 }),
    jevAssessment: varchar('jev_assessment', { length: 30 }),
    jevConfidence: real('jev_confidence'),
    jevModelVersion: varchar('jev_model_version', { length: 50 }),
    jevInputTokens: integer('jev_input_tokens'),
    durationMs: real('duration_ms').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCampaignIdx: index('decision_events_tenant_campaign_idx').on(t.tenantId, t.campaignId),
    timestampIdx: index('decision_events_timestamp_idx').on(t.timestamp),
  }),
);

export const dailyMetrics = pgTable(
  'daily_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    date: timestamp('date', { withTimezone: true }).notNull(),
    totalRequests: integer('total_requests').notNull().default(0),
    routePrimary: integer('route_primary').notNull().default(0),
    routeAlternative: integer('route_alternative').notNull().default(0),
    challenges: integer('challenges').notNull().default(0),
    denials: integer('denials').notNull().default(0),
    jevCalls: integer('jev_calls').notNull().default(0),
    jevTokens: integer('jev_tokens').notNull().default(0),
    avgDurationMs: real('avg_duration_ms'),
  },
  (t) => ({
    tenantCampaignDateIdx: uniqueIndex('daily_metrics_tenant_campaign_date_idx').on(
      t.tenantId,
      t.campaignId,
      t.date,
    ),
  }),
);

export const budgetReservations = pgTable(
  'budget_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    reservedAt: timestamp('reserved_at', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    tokensReserved: integer('tokens_reserved').notNull(),
    tokensUsed: integer('tokens_used'),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('pending')
      .$type<'pending' | 'used' | 'released'>(),
  },
  (t) => ({
    tenantIdx: index('budget_reservations_tenant_idx').on(t.tenantId),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id'),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    changes: jsonb('changes'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('audit_log_tenant_idx').on(t.tenantId),
    timestampIdx: index('audit_log_timestamp_idx').on(t.timestamp),
  }),
);
