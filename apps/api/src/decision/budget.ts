import { eq, sql } from 'drizzle-orm';
import { budgetReservations } from '@botbad/db';
import { getDb } from '../db.js';

interface BudgetConfig {
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  reservationSize: number;
}

const DEFAULT_CONFIG: BudgetConfig = {
  dailyTokenLimit: 50_000_000,
  monthlyTokenLimit: 500_000_000,
  reservationSize: 1000,
};

interface BudgetAlert {
  level: '80%' | '95%' | '100%';
  scope: 'daily' | 'monthly';
  tenantId: string;
  used: number;
  limit: number;
}

const emittedAlerts = new Set<string>();

function emitAlert(alert: BudgetAlert): void {
  const key = `${alert.tenantId}:${alert.scope}:${alert.level}`;
  if (emittedAlerts.has(key)) return;
  emittedAlerts.add(key);
  console.warn(`[budget-alert] ${alert.level} ${alert.scope} limit for tenant ${alert.tenantId}: ${alert.used}/${alert.limit}`);
}

function checkAlerts(tenantId: string, used: number, limit: number, scope: 'daily' | 'monthly'): void {
  const ratio = used / limit;
  if (ratio >= 1.0) emitAlert({ level: '100%', scope, tenantId, used, limit });
  else if (ratio >= 0.95) emitAlert({ level: '95%', scope, tenantId, used, limit });
  else if (ratio >= 0.80) emitAlert({ level: '80%', scope, tenantId, used, limit });
}

export async function reserveBudget(
  tenantId: string,
  config: BudgetConfig = DEFAULT_CONFIG,
): Promise<{ reserved: boolean; reservationId?: string; reason?: string }> {
  const db = getDb();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  try {
    const outcome = await db.transaction(async (tx) => {
      // Serialize reservations per tenant: concurrent requests cannot both pass the ceiling check.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`budget:${tenantId}`}))`);

      // Released reservations gave their tokens back; used ones hold the reconciled real usage.
      const totals = await tx.execute<{ daily: string; monthly: string }>(sql`
        SELECT
          coalesce(sum(tokens_reserved) FILTER (WHERE reserved_at >= ${startOfDay}), 0) AS daily,
          coalesce(sum(tokens_reserved), 0) AS monthly
        FROM budget_reservations
        WHERE tenant_id = ${tenantId} AND reserved_at >= ${startOfMonth} AND status <> 'released'
      `);
      const daily = Number(totals.rows[0]?.daily ?? 0);
      const monthly = Number(totals.rows[0]?.monthly ?? 0);

      if (daily + config.reservationSize > config.dailyTokenLimit) {
        return { reserved: false as const, scope: 'daily' as const, daily, monthly };
      }
      if (monthly + config.reservationSize > config.monthlyTokenLimit) {
        return { reserved: false as const, scope: 'monthly' as const, daily, monthly };
      }

      const [row] = await tx
        .insert(budgetReservations)
        .values({ tenantId, tokensReserved: config.reservationSize, status: 'pending' })
        .returning({ id: budgetReservations.id });
      return {
        reserved: true as const,
        reservationId: row!.id,
        daily: daily + config.reservationSize,
        monthly: monthly + config.reservationSize,
      };
    });

    checkAlerts(tenantId, outcome.daily, config.dailyTokenLimit, 'daily');
    checkAlerts(tenantId, outcome.monthly, config.monthlyTokenLimit, 'monthly');

    if (!outcome.reserved) {
      return {
        reserved: false,
        reason: outcome.scope === 'daily' ? 'Daily token budget exhausted' : 'Monthly token budget exhausted',
      };
    }
    return { reserved: true, reservationId: outcome.reservationId };
  } catch (err) {
    console.error('[budget] reservation failed:', err instanceof Error ? err.message : err);
    return { reserved: false, reason: 'Budget check failed (database unavailable)' };
  }
}

export async function reconcileBudget(
  reservationId: string,
  tokensUsed: number,
): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(budgetReservations)
      .set({
        tokensUsed,
        status: 'used',
        releasedAt: new Date(),
        // Count real usage against the ceiling. Unknown usage (0) keeps the conservative reservation.
        ...(tokensUsed > 0 ? { tokensReserved: tokensUsed } : {}),
      })
      .where(eq(budgetReservations.id, reservationId));
  } catch {
    console.error(`[budget] Failed to reconcile reservation ${reservationId}`);
  }
}

export async function releaseBudget(reservationId: string): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(budgetReservations)
      .set({
        tokensUsed: 0,
        status: 'released',
        releasedAt: new Date(),
      })
      .where(eq(budgetReservations.id, reservationId));
  } catch {
    console.error(`[budget] Failed to release reservation ${reservationId}`);
  }
}

export function resetAlertsForTesting(): void {
  emittedAlerts.clear();
}
