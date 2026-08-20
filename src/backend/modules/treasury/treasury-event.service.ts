import { AppError, NotFoundError } from "@/backend/core/errors";
import { withTenantTransaction } from "@/backend/core/prisma-client";
import type { RequestContext } from "@/backend/core/tenant";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import type { CashFlowEvent } from "@/shared/types";

import { cashFlowEventRepository } from "./cash-flow-event.repository";
import type {
  CreateCashFlowEventInput,
  ListCashFlowEventsQuery,
  UpdateCashFlowEventInput,
} from "./treasury.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `CashFlowEvent`, `BudgetLine`'dan BAĞIMSIZ bir defterdir (bkz.
 * prisma/schema.prisma'daki 14. bölüm notu) — `budgetLineService.bulkUpsert`e
 * HİÇ dokunmaz, kendi repository'sine yazar. Yine de `scenario.isLocked`
 * kontrolüne AYNI disiplinle tabidir (`budget-line.service.ts#bulkUpsert`
 * ile aynı 409 `SCENARIO_LOCKED` davranışı) — kilitli bir senaryonun nakit
 * defteri de donmuş kabul edilir. Kontrol+yazma TEK bir
 * `withTenantTransaction` içinde yapılır (check-then-act yarışını önlemek
 * için — bkz. `budgetLineService.bulkUpsert`teki aynı gerekçe).
 *
 * Faz 4.1 kapsamı: minimal CRUD. THP içe aktarım (Faz 4.2), mutabakat
 * (Faz 4.3) ve projeksiyon/what-if (Faz 4.4) sonraki fazlarda gelir.
 */
export const treasuryEventService = {
  async list(
    tenantId: string,
    query: ListCashFlowEventsQuery,
  ): Promise<CashFlowEvent[]> {
    return cashFlowEventRepository.findByScenario(tenantId, query.scenarioId, {
      status: query.status,
    });
  },

  async get(tenantId: string, id: string): Promise<CashFlowEvent> {
    const event = await cashFlowEventRepository.findById(tenantId, id);
    if (!event) throw new NotFoundError("Nakit olayı");
    return event;
  },

  async create(
    context: RequestContext,
    input: CreateCashFlowEventInput,
  ): Promise<CashFlowEvent> {
    return withTenantTransaction(context.tenantId, async (tx) => {
      await assertScenarioNotLocked(context.tenantId, input.scenarioId, tx);
      return cashFlowEventRepository.create(context.tenantId, context.userId, input);
    });
  },

  async update(
    context: RequestContext,
    id: string,
    input: UpdateCashFlowEventInput,
  ): Promise<CashFlowEvent> {
    const current = await this.get(context.tenantId, id);

    return withTenantTransaction(context.tenantId, async (tx) => {
      await assertScenarioNotLocked(context.tenantId, current.scenarioId, tx);
      const updated = await cashFlowEventRepository.update(context.tenantId, id, input);
      if (!updated) throw new NotFoundError("Nakit olayı");
      return updated;
    });
  },

  async delete(context: RequestContext, id: string): Promise<void> {
    const current = await this.get(context.tenantId, id);

    await withTenantTransaction(context.tenantId, async (tx) => {
      await assertScenarioNotLocked(context.tenantId, current.scenarioId, tx);
      const deleted = await cashFlowEventRepository.delete(context.tenantId, id);
      if (!deleted) throw new NotFoundError("Nakit olayı");
    });
  },
};

async function assertScenarioNotLocked(
  tenantId: string,
  scenarioId: string,
  tx: Parameters<typeof scenarioRepository.findById>[2],
): Promise<void> {
  const scenario = await scenarioRepository.findById(tenantId, scenarioId, tx);
  if (!scenario) throw new NotFoundError("Senaryo");
  if (scenario.isLocked) {
    throw new AppError(
      "SCENARIO_LOCKED",
      `"${scenario.name}" kilitli. Nakit olayı eklemeden/düzenlemeden önce senaryonun kilidini açın.`,
      409,
    );
  }
}
