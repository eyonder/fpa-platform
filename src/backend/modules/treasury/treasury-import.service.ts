import { AppError, NotFoundError } from "@/backend/core/errors";
import { withTenantTransaction } from "@/backend/core/prisma-client";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { parseFile } from "@/backend/core/tabular-file";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import type {
  CashFlowEvent,
  ThpColumnMapping,
  TreasuryImportBatch,
} from "@/shared/types";

import { cashFlowEventRepository } from "./cash-flow-event.repository";
import type { ValidThpImportRow } from "./cash-flow-event.repository";
import { mappingConfigRepository } from "./mapping-config.repository";
import { resolveThpRows, suggestTreasuryColumns } from "./thp-mapping";
import { treasuryImportRepository } from "./treasury-import.repository";
import type { TreasuryImportBatchRecord } from "./treasury-import.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `import.service.ts`teki AYNI üç adımlı sihirbaz iskeleti — create (ayrıştır
 * + öner + önizle, HİÇBİR ŞEY yazmaz) → remap (ham veriden yeniden çözümle)
 * → commit (geçerli satırları CashFlowEvent'e yaz). TEK gerçek fark: önizleme
 * (rows/issues) HİÇBİR adımda PERSİST edilmez — her çağrıda rawGrid +
 * appliedMapping + O ANKİ MappingConfig kurallarından yeniden hesaplanır
 * (bkz. treasury-import.repository.ts dosya başı notu) — payroll/depreciation/
 * sales-forecast'teki "recompute, don't persist" disipliniyle AYNI.
 */
export const treasuryImportService = {
  async create(
    context: RequestContext,
    scenarioId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<TreasuryImportBatch> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const { headers, rows } = await parseFile(buffer, fileName);
    const suggestedMapping = suggestTreasuryColumns(headers);

    const record = await treasuryImportRepository.create(
      context.tenantId,
      context.userId,
      scenarioId,
      fileName,
      "THP",
    );
    await treasuryImportRepository.saveRawGrid(record.id, { headers, rows });

    const { previewRows, issues, mappedCount, skippedCount } = await resolvePreview(
      context.tenantId,
      headers,
      rows,
      suggestedMapping,
    );

    const updated = await treasuryImportRepository.updateMapping(
      record.id,
      suggestedMapping,
      { rowCount: rows.length, mappedCount, skippedCount },
    );

    return toBatch(updated, headers, suggestedMapping, previewRows, issues);
  },

  async remap(
    context: RequestContext,
    batchId: string,
    mapping: ThpColumnMapping[],
  ): Promise<TreasuryImportBatch> {
    const record = await getOwnedBatch(context, batchId);
    assertPendingReview(record);

    const grid = await treasuryImportRepository.findRawGrid(batchId);
    if (!grid) throw new NotFoundError("İçe aktarma (ham veri)");

    const { previewRows, issues, mappedCount, skippedCount } = await resolvePreview(
      context.tenantId,
      grid.headers,
      grid.rows,
      mapping,
    );

    const updated = await treasuryImportRepository.updateMapping(batchId, mapping, {
      rowCount: grid.rows.length,
      mappedCount,
      skippedCount,
    });

    return toBatch(
      updated,
      grid.headers,
      suggestTreasuryColumns(grid.headers),
      previewRows,
      issues,
    );
  },

  async get(context: RequestContext, batchId: string): Promise<TreasuryImportBatch> {
    const record = await getOwnedBatch(context, batchId);
    const grid = await treasuryImportRepository.findRawGrid(batchId);

    // commit sonrası rawGrid temizlenir (bkz. markCommitted) — önizlenecek
    // ham veri kalmaz, sadece özet sayaçlar döner.
    if (!grid) return toBatch(record, [], [], [], []);

    const mapping = record.appliedMapping ?? suggestTreasuryColumns(grid.headers);
    const { previewRows, issues } = await resolvePreview(
      context.tenantId,
      grid.headers,
      grid.rows,
      mapping,
    );

    return toBatch(
      record,
      grid.headers,
      suggestTreasuryColumns(grid.headers),
      previewRows,
      issues,
    );
  },

  async commit(
    context: RequestContext,
    batchId: string,
  ): Promise<{ batch: TreasuryImportBatch; createdEvents: CashFlowEvent[] }> {
    const record = await getOwnedBatch(context, batchId);
    assertPendingReview(record);

    const grid = await treasuryImportRepository.findRawGrid(batchId);
    if (!grid) throw new NotFoundError("İçe aktarma (ham veri)");

    const mapping = record.appliedMapping ?? suggestTreasuryColumns(grid.headers);
    const { previewRows } = await resolvePreview(
      context.tenantId,
      grid.headers,
      grid.rows,
      mapping,
    );

    // Geçerli satır = eşleşti (mappingConfigId dolu) + NAKİT katmanı (ACCRUAL
    // hesaplar burada da bilerek dışlanır) + vade çözümlendi + pozitif tutar.
    const validRows: ValidThpImportRow[] = previewRows.filter(
      (r): r is typeof r & ValidThpImportRow =>
        r.mappingConfigId !== null &&
        r.layer === "CASH" &&
        r.dueDate !== null &&
        r.amount !== null &&
        r.amount > 0 &&
        r.categoryId !== null &&
        r.direction !== null,
    );

    if (validRows.length === 0) {
      throw new AppError(
        "TREASURY_IMPORT_NO_VALID_ROWS",
        "Aktarılacak geçerli satır yok (tümü tahakkuk hesabı, eşleşmemiş ya da vadesiz).",
        422,
      );
    }

    const createdEvents = await withTenantTransaction(context.tenantId, async (tx) => {
      const scenario = await scenarioRepository.findById(
        context.tenantId,
        record.scenarioId,
        tx,
      );
      if (!scenario) throw new NotFoundError("Senaryo");
      if (scenario.isLocked) {
        throw new AppError(
          "SCENARIO_LOCKED",
          `"${scenario.name}" kilitli. İçe aktarımı onaylamadan önce senaryonun kilidini açın.`,
          409,
        );
      }

      return cashFlowEventRepository.createManyFromImport(
        context.tenantId,
        context.userId,
        record.scenarioId,
        batchId,
        validRows,
        tx,
      );
    });

    const committed = await treasuryImportRepository.markCommitted(batchId);

    return { batch: toBatch(committed, [], [], [], []), createdEvents };
  },
};

async function resolvePreview(
  tenantId: string,
  headers: string[],
  rows: string[][],
  mapping: ThpColumnMapping[],
) {
  const [mappingConfigs, categories] = await Promise.all([
    mappingConfigRepository.findActiveByTenant(tenantId),
    budgetLineRepository.findCategories(),
  ]);
  const { previewRows, issues } = resolveThpRows(
    headers,
    rows,
    mapping,
    mappingConfigs,
    categories,
  );
  const mappedCount = previewRows.filter(
    (r) => r.mappingConfigId !== null && r.layer === "CASH" && r.dueDate !== null,
  ).length;
  const skippedCount = previewRows.length - mappedCount;
  return { previewRows, issues, mappedCount, skippedCount };
}

function toBatch(
  record: TreasuryImportBatchRecord,
  detectedColumns: string[],
  suggestedMapping: ThpColumnMapping[],
  rows: TreasuryImportBatch["rows"],
  issues: TreasuryImportBatch["issues"],
): TreasuryImportBatch {
  return {
    ...record,
    appliedMapping: record.appliedMapping ?? suggestedMapping,
    detectedColumns,
    suggestedMapping,
    rows,
    issues,
  };
}

async function getOwnedBatch(
  context: RequestContext,
  batchId: string,
): Promise<TreasuryImportBatchRecord> {
  const record = await treasuryImportRepository.findById(context.tenantId, batchId);
  if (!record) throw new NotFoundError("İçe aktarma");
  // Aynı tablo banka ekstresi sihirbazıyla PAYLAŞILIR (bkz.
  // bank-import.service.ts) — yanlış türdeki bir parti buraya sızarsa
  // `appliedMapping` şekli uyuşmaz ve önizleme sessizce boşalırdı.
  if (record.kind !== "THP") {
    throw new AppError(
      "TREASURY_IMPORT_KIND_MISMATCH",
      "Bu içe aktarma bir THP mizanı değil.",
      409,
    );
  }
  return record;
}

function assertPendingReview(record: TreasuryImportBatchRecord): void {
  if (record.status !== "PENDING_REVIEW") {
    throw new AppError(
      "TREASURY_IMPORT_ALREADY_FINALIZED",
      "Bu içe aktarma zaten sonuçlandırılmış (onaylanmış ya da iptal edilmiş).",
      409,
    );
  }
}
