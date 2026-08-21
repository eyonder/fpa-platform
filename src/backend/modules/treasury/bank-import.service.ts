import { AppError, NotFoundError } from "@/backend/core/errors";
import { withTenantTransaction } from "@/backend/core/prisma-client";
import { parseFile } from "@/backend/core/tabular-file";
import type { RequestContext } from "@/backend/core/tenant";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import type { BankColumnMapping, BankImportBatch } from "@/shared/types";

import { resolveBankRows, suggestBankColumns } from "./bank-statement-mapping";
import { bankTransactionRepository } from "./bank-transaction.repository";
import type { ValidBankImportRow } from "./bank-transaction.repository";
import { treasuryImportRepository } from "./treasury-import.repository";
import type { TreasuryImportBatchRecord } from "./treasury-import.repository";

/**
 * İŞ MANTIĞI KATMANI (Service) — BANKA EKSTRESİ İÇE AKTARIMI.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez.
 *
 * `treasury-import.service.ts` (THP) ile AYNI üç adımlı iskelet ve AYNI
 * "recompute, don't persist" disiplini: önizleme HİÇBİR adımda saklanmaz,
 * her çağrıda `rawGrid` + `appliedMapping` + O ANKİ mükerrer referans
 * kümesinden yeniden hesaplanır. AYNI `TreasuryImportBatch` tablosu
 * paylaşılır, `kind = BANK_STATEMENT` ile ayrışır.
 *
 * THP'den İKİ FARK, ikisi de kasıtlı:
 *  1. `MappingConfig` kuralları DEVREDE DEĞİL — banka ekstresi hesap planı
 *     taşımaz (bkz. bank-statement-mapping.ts dosya başı notu).
 *  2. `scenario.isLocked` kontrolü YOK — banka hareketi SENARYOYA AİT
 *     DEĞİLDİR (bkz. bank.service.ts). `scenarioId` yine de kaydedilir:
 *     `TreasuryImportBatch` paylaşılan bir tablodur ve alan zorunludur;
 *     "hangi senaryo ekranından yüklendi" bilgisi olarak anlamlıdır.
 */
export const bankImportService = {
  async create(
    context: RequestContext,
    scenarioId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<BankImportBatch> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const { headers, rows } = await parseFile(buffer, fileName);
    const suggestedMapping = suggestBankColumns(headers);

    const record = await treasuryImportRepository.create(
      context.tenantId,
      context.userId,
      scenarioId,
      fileName,
      "BANK_STATEMENT",
    );
    await treasuryImportRepository.saveRawGrid(record.id, { headers, rows });

    const resolved = await resolvePreview(
      context.tenantId,
      headers,
      rows,
      suggestedMapping,
    );

    const updated = await treasuryImportRepository.updateMapping<BankColumnMapping[]>(
      record.id,
      suggestedMapping,
      {
        rowCount: rows.length,
        mappedCount: resolved.mappedCount,
        skippedCount: resolved.skippedCount,
      },
    );

    return toBatch(
      updated,
      headers,
      suggestedMapping,
      resolved.previewRows,
      resolved.issues,
    );
  },

  async remap(
    context: RequestContext,
    batchId: string,
    mapping: BankColumnMapping[],
  ): Promise<BankImportBatch> {
    const record = await getOwnedBatch(context, batchId);
    assertPendingReview(record);

    const grid = await treasuryImportRepository.findRawGrid(batchId);
    if (!grid) throw new NotFoundError("İçe aktarma (ham veri)");

    const resolved = await resolvePreview(
      context.tenantId,
      grid.headers,
      grid.rows,
      mapping,
    );

    const updated = await treasuryImportRepository.updateMapping<BankColumnMapping[]>(
      batchId,
      mapping,
      {
        rowCount: grid.rows.length,
        mappedCount: resolved.mappedCount,
        skippedCount: resolved.skippedCount,
      },
    );

    return toBatch(
      updated,
      grid.headers,
      suggestBankColumns(grid.headers),
      resolved.previewRows,
      resolved.issues,
    );
  },

  async get(context: RequestContext, batchId: string): Promise<BankImportBatch> {
    const record = await getOwnedBatch(context, batchId);
    const grid = await treasuryImportRepository.findRawGrid(batchId);

    // commit sonrası rawGrid temizlenir — önizlenecek ham veri kalmaz.
    if (!grid) return toBatch(record, [], [], [], []);

    const mapping = record.appliedMapping ?? suggestBankColumns(grid.headers);
    const resolved = await resolvePreview(
      context.tenantId,
      grid.headers,
      grid.rows,
      mapping,
    );

    return toBatch(
      record,
      grid.headers,
      suggestBankColumns(grid.headers),
      resolved.previewRows,
      resolved.issues,
    );
  },

  async commit(
    context: RequestContext,
    batchId: string,
    bankAccountId: string,
  ): Promise<{ batch: BankImportBatch; createdCount: number }> {
    const record = await getOwnedBatch(context, batchId);
    assertPendingReview(record);

    const grid = await treasuryImportRepository.findRawGrid(batchId);
    if (!grid) throw new NotFoundError("İçe aktarma (ham veri)");

    const mapping = record.appliedMapping ?? suggestBankColumns(grid.headers);
    const { previewRows } = await resolvePreview(
      context.tenantId,
      grid.headers,
      grid.rows,
      mapping,
    );

    // Geçerli satır = tarih çözümlendi + tutar/yön okundu + mükerrer DEĞİL.
    // Açıklama boşsa satır yine de yazılır (eşleştirme puanı düşer, veri
    // kaybı olmaz) — bu yüzden yer tutucu bir metin konur.
    const validRows: ValidBankImportRow[] = previewRows
      .filter(
        (r) =>
          !r.isDuplicate &&
          r.valueDate !== null &&
          r.amount !== null &&
          r.direction !== null,
      )
      .map((r) => ({
        valueDate: r.valueDate as string,
        direction: r.direction as ValidBankImportRow["direction"],
        amount: r.amount as number,
        description: r.description ?? "(açıklama yok)",
        counterparty: r.counterparty,
        externalRef: r.externalRef,
      }));

    if (validRows.length === 0) {
      throw new AppError(
        "BANK_IMPORT_NO_VALID_ROWS",
        "Aktarılacak geçerli satır yok (tümü mükerrer, tarihsiz ya da tutarsız).",
        422,
      );
    }

    const createdCount = await withTenantTransaction(context.tenantId, async (tx) =>
      bankTransactionRepository.createManyFromImport(
        context.tenantId,
        context.userId,
        bankAccountId,
        batchId,
        validRows,
        tx,
      ),
    );

    const committed =
      await treasuryImportRepository.markCommitted<BankColumnMapping[]>(batchId);

    return { batch: toBatch(committed, [], [], [], []), createdCount };
  },
};

async function resolvePreview(
  tenantId: string,
  headers: string[],
  rows: string[][],
  mapping: BankColumnMapping[],
) {
  // Mükerrer tespiti HER ÇAĞRIDA taze yapılır — arada aynı ekstre başka bir
  // partiden commit edilmiş olabilir; önizlemenin bunu göstermesi gerekir.
  const refIdx = mapping.findIndex((m) => m.targetField === "externalRef");
  const refs =
    refIdx >= 0
      ? rows.map((row) => (row[refIdx] ?? "").trim()).filter((ref) => ref !== "")
      : [];
  const existingRefs = await bankTransactionRepository.findExistingRefs(tenantId, refs);

  const { previewRows, issues } = resolveBankRows(headers, rows, mapping, existingRefs);
  const mappedCount = previewRows.filter(
    (r) => !r.isDuplicate && r.valueDate !== null && r.amount !== null,
  ).length;
  return {
    previewRows,
    issues,
    mappedCount,
    skippedCount: previewRows.length - mappedCount,
  };
}

function toBatch(
  record: TreasuryImportBatchRecord<BankColumnMapping[]>,
  detectedColumns: string[],
  suggestedMapping: BankColumnMapping[],
  rows: BankImportBatch["rows"],
  issues: BankImportBatch["issues"],
): BankImportBatch {
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
): Promise<TreasuryImportBatchRecord<BankColumnMapping[]>> {
  const record = await treasuryImportRepository.findById<BankColumnMapping[]>(
    context.tenantId,
    batchId,
  );
  if (!record) throw new NotFoundError("İçe aktarma");
  if (record.kind !== "BANK_STATEMENT") {
    throw new AppError(
      "TREASURY_IMPORT_KIND_MISMATCH",
      "Bu içe aktarma bir banka ekstresi değil.",
      409,
    );
  }
  return record;
}

function assertPendingReview(
  record: TreasuryImportBatchRecord<BankColumnMapping[]>,
): void {
  if (record.status !== "PENDING_REVIEW") {
    throw new AppError(
      "TREASURY_IMPORT_ALREADY_FINALIZED",
      "Bu içe aktarma zaten sonuçlandırılmış (onaylanmış ya da iptal edilmiş).",
      409,
    );
  }
}
