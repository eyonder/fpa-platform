import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney, toMinorUnits } from "@/shared/lib/money";
import type {
  AllocationReportRow,
  BudgetLineInput,
  ExpenseEntry,
} from "@/shared/types";

import { allocationKeyRepository } from "./allocation-key.repository";
import { costCenterService } from "./cost-center.service";
import type { AllocationEntryInput, AllocationKeyInput } from "./expense-allocation";
import { computeAllocationReport } from "./expense-allocation";
import { expenseEntryRepository } from "./expense-entry.repository";
import type {
  CreateExpenseEntryInput,
  ListExpenseEntriesQuery,
} from "./expense-entry.schema";

/**
 * İŞ MANTIĞI KATMANI (Service) — onay akışı durum makinesi.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Akış: DRAFT/REJECTED -[submit]-> SUBMITTED -[approve]-> APPROVED -[commit]-> COMMITTED
 *                                            \-[reject]--> REJECTED (tekrar düzenlenip gönderilebilir)
 *
 * `assertEditable`, `import.service.ts`teki `assertPendingReview`in AYNI
 * deseni: her mutasyon metodunun BAŞINDA gerekli önceki durumu kontrol eder.
 * Onay akışının kendi denetim alanları (submittedBy..., decidedBy...,
 * rejectionReason) bu satırın ÜZERİNDE tutulur — AYRI bir AuditLog kaydı YOK (ImportJob'un
 * kendi durumunu izleme deseniyle aynı); sadece nihai `commitApproved` adımı,
 * `budgetLineService.bulkUpsert` üzerinden GERÇEK AuditLog kayıtları üretir.
 */
export const expenseEntryService = {
  async list(
    context: RequestContext,
    query: ListExpenseEntriesQuery,
  ): Promise<ExpenseEntry[]> {
    return expenseEntryRepository.findByScenario(context.tenantId, query.scenarioId, {
      costCenterId: query.costCenterId,
      status: query.status,
    });
  },

  async get(context: RequestContext, id: string): Promise<ExpenseEntry> {
    const entry = await expenseEntryRepository.findById(context.tenantId, id);
    if (!entry) throw new NotFoundError("Gider kaydı");
    return entry;
  },

  async create(
    context: RequestContext,
    input: CreateExpenseEntryInput,
  ): Promise<ExpenseEntry> {
    const scenario = await scenarioRepository.findById(
      context.tenantId,
      input.scenarioId,
    );
    if (!scenario) throw new NotFoundError("Senaryo");

    await costCenterService.get(context.tenantId, input.costCenterId); // yoksa 404
    await assertExpenseCategory(input.categoryId);

    const existing = await expenseEntryRepository.findByCombo(
      context.tenantId,
      input.scenarioId,
      input.costCenterId,
      input.categoryId,
      input.month,
    );
    if (existing) {
      throw new AppError(
        "EXPENSE_ENTRY_ALREADY_EXISTS",
        "Bu gider merkezi/tür/ay için zaten bir kayıt var — mevcut kaydı düzenleyin.",
        409,
      );
    }

    return expenseEntryRepository.create(context.tenantId, input);
  },

  async update(
    context: RequestContext,
    id: string,
    amount: number,
  ): Promise<ExpenseEntry> {
    const entry = await this.get(context, id);
    assertEditable(entry);

    const updated = await expenseEntryRepository.updateAmount(
      context.tenantId,
      id,
      amount,
    );
    if (!updated) throw new NotFoundError("Gider kaydı");
    return updated;
  },

  async submit(context: RequestContext, id: string): Promise<ExpenseEntry> {
    const entry = await this.get(context, id);
    assertEditable(entry);

    const updated = await expenseEntryRepository.transitionToSubmitted(
      context.tenantId,
      id,
      context.userId,
      context.userName,
    );
    if (!updated) throw new NotFoundError("Gider kaydı");
    return updated;
  },

  async approve(context: RequestContext, id: string): Promise<ExpenseEntry> {
    const entry = await this.get(context, id);
    assertSubmitted(entry);

    const updated = await expenseEntryRepository.transitionToApproved(
      context.tenantId,
      id,
      context.userId,
      context.userName,
    );
    if (!updated) throw new NotFoundError("Gider kaydı");
    return updated;
  },

  async reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<ExpenseEntry> {
    const entry = await this.get(context, id);
    assertSubmitted(entry);

    const updated = await expenseEntryRepository.transitionToRejected(
      context.tenantId,
      id,
      context.userId,
      context.userName,
      reason,
    );
    if (!updated) throw new NotFoundError("Gider kaydı");
    return updated;
  },

  /**
   * APPROVED kayıtları `${categoryId}:${month}` bazında toplayıp TEK bütçe
   * yazma noktası olan `budgetLineService.bulkUpsert`e (kaynak: EXPENSE)
   * gönderir — kilit kontrolü ve audit kaydı oradan otomatik gelir. Ardından
   * (import.service.ts#commit'teki İKİ ADIMLI sıralamayla AYNI şekilde) bu
   * kayıtları AYRI bir çağrıyla COMMITTED işaretler.
   */
  async commitApproved(context: RequestContext, scenarioId: string) {
    const approved = await expenseEntryRepository.findApprovedByScenario(
      context.tenantId,
      scenarioId,
    );

    if (approved.length === 0) {
      throw new AppError(
        "EXPENSE_NO_APPROVED_ENTRIES",
        "Bütçeye yazılacak onaylı gider kaydı yok.",
        422,
      );
    }

    const mergedByKey = new Map<string, number>();
    for (const entry of approved) {
      const key = `${entry.categoryId}:${entry.month}`;
      mergedByKey.set(key, roundMoney((mergedByKey.get(key) ?? 0) + entry.amount));
    }
    const lines: BudgetLineInput[] = [...mergedByKey.entries()].map(([key, amount]) => {
      const [categoryId, month] = key.split(":");
      return { categoryId, month: Number(month), amount };
    });

    const committedLines = await budgetLineService.bulkUpsert(
      context,
      scenarioId,
      lines,
      "EXPENSE",
    );

    await expenseEntryRepository.markCommitted(
      context.tenantId,
      approved.map((e) => e.id),
    );

    return committedLines;
  },

  /**
   * Sadece COMMITTED kayıtları raporlar — bu, gerçekten bütçeye yazılmış
   * (kilitlenmiş) tutarların gider merkezleri arasında NASIL dağıldığını
   * gösterir. DRAFT/SUBMITTED/APPROVED henüz bütçeye yansımamış rakamlardır,
   * raporda YOKTUR (bkz. expense-allocation.ts'teki "sadece raporlama" notu).
   */
  async allocationReport(
    context: RequestContext,
    scenarioId: string,
  ): Promise<AllocationReportRow[]> {
    const committed = await expenseEntryRepository.findByScenario(
      context.tenantId,
      scenarioId,
      { status: "COMMITTED" },
    );
    const keys = await allocationKeyRepository.findByTenant(context.tenantId);

    const entryInputs: AllocationEntryInput[] = committed.map((e) => ({
      costCenterId: e.costCenterId,
      categoryId: e.categoryId,
      month: e.month,
      amountMinor: toMinorUnits(e.amount),
    }));
    const keyInputs: AllocationKeyInput[] = keys.map((k) => ({
      sourceCostCenterId: k.sourceCostCenterId,
      members: k.members,
    }));

    return computeAllocationReport(entryInputs, keyInputs).map((row) => ({
      costCenterId: row.costCenterId,
      categoryId: row.categoryId,
      month: row.month,
      amount: row.amountMinor / 100,
    }));
  },
};

function assertEditable(entry: ExpenseEntry): void {
  if (entry.status !== "DRAFT" && entry.status !== "REJECTED") {
    throw new AppError(
      "EXPENSE_ENTRY_NOT_EDITABLE",
      "Bu gider kaydı yalnızca taslak ya da reddedilmiş durumdayken düzenlenebilir.",
      409,
    );
  }
}

function assertSubmitted(entry: ExpenseEntry): void {
  if (entry.status !== "SUBMITTED") {
    throw new AppError(
      "EXPENSE_ENTRY_NOT_SUBMITTED",
      "Bu işlem yalnızca onaya gönderilmiş kayıtlar için yapılabilir.",
      409,
    );
  }
}

async function assertExpenseCategory(categoryId: string): Promise<void> {
  const categories = await budgetLineRepository.findCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) throw new NotFoundError("Gider türü");
  if (category.type !== "EXPENSE") {
    throw new AppError(
      "EXPENSE_ENTRY_INVALID_CATEGORY",
      `"${category.name}" bir gider türü değil.`,
      422,
    );
  }
}
