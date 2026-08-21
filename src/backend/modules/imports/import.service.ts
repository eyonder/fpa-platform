import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney } from "@/shared/lib/money";
import type {
  BudgetLine,
  BudgetLineInput,
  ImportBatch,
  ImportColumnMapping,
} from "@/shared/types";

import { resolveRows, suggestMapping } from "./import-mapping";
import { parseFile } from "@/backend/core/tabular-file";
import { importRepository } from "./import.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Sihirbaz akışı (üç adım, üç metod):
 *   1. create — dosyayı ayrıştır, kolon eşleştirmesini TAHMİN et, önizle.
 *      HENÜZ bütçeye hiçbir şey yazılmaz.
 *   2. remap  — kullanıcı eşleştirmeyi düzeltir, HAM veriden yeniden çözümlenir.
 *   3. commit — geçerli satırlar budgetLineService.bulkUpsert'e gider; bu da
 *      kilit kontrolünü VE audit kaydını (kaynak: IMPORT) kendisi uygular.
 */
export const importService = {
  async create(
    context: RequestContext,
    scenarioId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<ImportBatch> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const { headers, rows } = await parseFile(buffer, fileName);
    const categories = await budgetLineRepository.findCategories(context.tenantId);
    const suggestedMapping = suggestMapping(headers);
    const { previewRows, issues } = resolveRows(
      headers,
      rows,
      suggestedMapping,
      categories,
    );

    const batch: ImportBatch = {
      id: crypto.randomUUID(),
      tenantId: context.tenantId,
      scenarioId,
      fileName,
      status: "PENDING_REVIEW",
      detectedColumns: headers,
      suggestedMapping,
      appliedMapping: suggestedMapping,
      rows: previewRows,
      issues,
      createdAt: new Date().toISOString(),
      createdByUserId: context.userId,
      createdByUserName: context.userName,
      committedAt: null,
    };

    await importRepository.save(batch);
    await importRepository.saveRawGrid(batch.id, { headers, rows });

    return batch;
  },

  async remap(
    context: RequestContext,
    batchId: string,
    mapping: ImportColumnMapping[],
  ): Promise<ImportBatch> {
    const batch = await getOwnedBatch(context, batchId);
    assertPendingReview(batch);

    const grid = await importRepository.findRawGrid(batchId);
    if (!grid) throw new NotFoundError("İçe aktarma (ham veri)");

    const categories = await budgetLineRepository.findCategories(context.tenantId);
    const { previewRows, issues } = resolveRows(
      grid.headers,
      grid.rows,
      mapping,
      categories,
    );

    const updated: ImportBatch = {
      ...batch,
      appliedMapping: mapping,
      rows: previewRows,
      issues,
    };
    await importRepository.save(updated);
    return updated;
  },

  async commit(
    context: RequestContext,
    batchId: string,
  ): Promise<{ batch: ImportBatch; committedLines: BudgetLine[] }> {
    const batch = await getOwnedBatch(context, batchId);
    assertPendingReview(batch);

    const validRows = batch.rows.filter(
      (r): r is typeof r & { categoryId: string; month: number; amount: number } =>
        r.categoryId !== null && r.month !== null && r.amount !== null,
    );

    if (validRows.length === 0) {
      throw new AppError(
        "IMPORT_NO_VALID_ROWS",
        "Aktarılacak geçerli satır yok. Eşleştirmeyi düzeltip tekrar deneyin.",
        422,
      );
    }

    // Aynı kategori+ay birden fazla satırda geçebilir (Mizan'da alt hesap
    // kırılımları olabilir, ör. "770.01 Kira" + "770.02 Aidat" -> ikisi de
    // cat-kira/aynı ay) -> toplayarak tek hücreye indir.
    const mergedByKey = new Map<string, number>();
    for (const row of validRows) {
      const key = `${row.categoryId}:${row.month}`;
      mergedByKey.set(key, roundMoney((mergedByKey.get(key) ?? 0) + row.amount));
    }
    const lines: BudgetLineInput[] = [...mergedByKey.entries()].map(([key, amount]) => {
      const [categoryId, month] = key.split(":");
      return { categoryId, month: Number(month), amount };
    });

    const committedLines = await budgetLineService.bulkUpsert(
      context,
      batch.scenarioId,
      lines,
      "IMPORT",
    );

    const updated: ImportBatch = {
      ...batch,
      status: "COMMITTED",
      committedAt: new Date().toISOString(),
    };
    await importRepository.save(updated);
    await importRepository.deleteRawGrid(batchId);

    return { batch: updated, committedLines };
  },

  async get(context: RequestContext, batchId: string): Promise<ImportBatch> {
    return getOwnedBatch(context, batchId);
  },
};

async function getOwnedBatch(
  context: RequestContext,
  batchId: string,
): Promise<ImportBatch> {
  const batch = await importRepository.findById(batchId);
  if (!batch || batch.tenantId !== context.tenantId)
    throw new NotFoundError("İçe aktarma");
  return batch;
}

function assertPendingReview(batch: ImportBatch): void {
  if (batch.status !== "PENDING_REVIEW") {
    throw new AppError(
      "IMPORT_ALREADY_FINALIZED",
      "Bu içe aktarma zaten sonuçlandırılmış (onaylanmış).",
      409,
    );
  }
}
