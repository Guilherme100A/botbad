import { eq, and, sql } from 'drizzle-orm';
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
    // Atomic INSERT ... SELECT to prevent TOCTOU race
    const result = await db.execute(sql`
      INSERT INTO budget_reservations (id, tenant_id, tokens_reserved, status, reserved_at)
      SELECT gen_random_uuid(), ${tenantId}, ${config.reservationSize}, 'pending', now()
      WHERE (
        SELECT coalesce(sum(tokens_reserved), 0)
        FROM budget_reservations
        WHERE tenant_id = ${tenantId} AND reserved_at >= ${startOfDay}
      ) + ${config.reservationSize} <= ${config.dailyTokenLimit}
      AND (
        SELECT coalesce(sum(tokens_reserved), 0)
        FROM budget_reservations
        WHERE tenant_id = ${tenantId} AND reserved_at >= ${startOfMonth}
      ) + ${config.reservationSize} <= ${config.monthlyTokenLimit}
      RETURNING id
    `);

    const rows = result as unknown as Array<{ id: string }>;
    if (!rows || rows.length === 0) {
      // Check which limit was hit for alerts
      const dailyRows = await db
        .select({
          total: sql<number>`coalesce(sum(${budgetReservations.tokensReserved}), 0)`.as('total'),
        })
        .from(budgetReservations)
        .where(
          and(
            eq(budgetReservations.tenantId, tenantId),
            sql`${budgetReservations.reservedAt} >= ${startOfDay}`,
          ),
        );
      const dailyUsed = Number(dailyRows[0]?.total ?? 0);
      checkAlerts(tenantId, dailyUsed, config.dailyTokenLimit, 'daily');

      if (dailyUsed + config.reservationSize > config.dailyTokenLimit) {
        return { reserved: false, reason: 'Daily token budget exhausted' };
      }
      return { reserved: false, reason: 'Monthly token budget exhausted' };
    }

    const reservationId = rows[0].id;

    // Fire alerts asynchronously
    const dailyRows = await db
      .select({
        total: sql<number>`coalesce(sum(${budgetReservations.tokensReserved}), 0)`.as('total'),
      })
      .from(budgetReservations)
      .where(
        and(
          eq(budgetReservations.tenantId, tenantId),
          sql`${budgetReservations.reservedAt} >= ${startOfDay}`,
        ),
      );
    const dailyUsed = Number(dailyRows[0]?.total ?? 0);
    checkAlerts(tenantId, dailyUsed, config.dailyTokenLimit, 'daily');

    const monthlyRows = await db
      .select({
        total: sql<number>`coalesce(sum(${budgetReservations.tokensReserved}), 0)`.as('total'),
      })
      .from(budgetReservations)
      .where(
        and(
          eq(budgetReservations.tenantId, tenantId),
          sql`${budgetReservations.reservedAt} >= ${startOfMonth}`,
        ),
      );
    const monthlyUsed = Number(monthlyRows[0]?.total ?? 0);
    checkAlerts(tenantId, monthlyUsed, config.monthlyTokenLimit, 'monthly');

    return { reserved: true, reservationId };
  } catch {
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
