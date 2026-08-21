import { fold } from "@/backend/modules/imports/import-mapping";
import { parseAmount } from "@/shared/lib/parse-amount";
import type {
  BudgetCategory,
  MappingConfigEntry,
  ThpColumnMapping,
  ThpPreviewRow,
  ThpRowIssue,
  ThpTargetField,
} from "@/shared/types";

import { parseDateLike, addDays } from "./treasury.dates";

/**
 * `import-mapping.ts`teki AYNI disiplin: HTTP'yi/Next.js'i/React'i bilmeyen,
 * saf, test edilebilir eşleştirme/çözümleme fonksiyonları.
 * `treasury-import.service.ts` bunları HTTP'den bağımsız olarak çağırır.
 */

const HEADER_HINTS: Record<Exclude<ThpTargetField, "skip">, string[]> = {
  accountCode: ["hesap kodu", "hesap no", "kod", "account code"],
  accountName: ["hesap adi", "hesap ad", "aciklama", "account name"],
  balance: ["bakiye", "tutar", "borc", "alacak", "balance"],
  dueDate: ["vade", "vade tarihi", "due date"],
  documentDate: ["belge tarihi", "fis tarihi", "document date"],
};

/** Başlık metinlerine bakarak hangi kolonun hesap kodu/adı/bakiye/vade
 * olduğunu tahmin eder — `import-mapping.ts#suggestMapping` ile AYNI desen. */
export function suggestTreasuryColumns(headers: string[]): ThpColumnMapping[] {
  const used = new Set<ThpTargetField>();

  return headers.map((header) => {
    const folded = fold(header);
    let target: ThpTargetField = "skip";

    for (const [field, hints] of Object.entries(HEADER_HINTS) as [
      Exclude<ThpTargetField, "skip">,
      string[],
    ][]) {
      if (used.has(field)) continue;
      if (hints.some((hint) => folded.includes(hint))) {
        target = field;
        break;
      }
    }

    if (target !== "skip") used.add(target);
    return { sourceColumn: header, targetField: target };
  });
}

/** THP kodları hiyerarşiktir ("120", "120.01", "120.01.003") —
 * `accountCode` bir ÖNEK olarak saklanır, EN UZUN eşleşen önek kazanır. Bir
 * tenant "320 -> cat-diger" tanımlayıp sonra "320.05 -> cat-kira" ile GENEL
 * kuralı bozmadan üzerine yazabilir. */
export function resolveThpMapping(
  rawCode: string,
  mappings: MappingConfigEntry[],
): MappingConfigEntry | null {
  const code = rawCode.trim().replace(/\s/g, "");
  if (!code) return null;

  const candidates = mappings.filter(
    (m) => m.isActive && code.startsWith(m.accountCode),
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => b.accountCode.length - a.accountCode.length)[0];
}

/** Uygulanan kolon eşleştirmesine ve GEÇERLİ MappingConfig kurallarına göre
 * ham satırları önizleme satırlarına + sorun listesine çevirir. */
export function resolveThpRows(
  headers: string[],
  rows: string[][],
  mapping: ThpColumnMapping[],
  mappingConfigs: MappingConfigEntry[],
  categories: BudgetCategory[],
): { previewRows: ThpPreviewRow[]; issues: ThpRowIssue[] } {
  const codeIdx = mapping.findIndex((m) => m.targetField === "accountCode");
  const nameIdx = mapping.findIndex((m) => m.targetField === "accountName");
  const balanceIdx = mapping.findIndex((m) => m.targetField === "balance");
  const dueDateIdx = mapping.findIndex((m) => m.targetField === "dueDate");
  const documentDateIdx = mapping.findIndex((m) => m.targetField === "documentDate");

  if (codeIdx === -1 || balanceIdx === -1) {
    return {
      previewRows: [],
      issues: [
        {
          rowNumber: 0,
          code: "MISSING_ACCOUNT_CODE",
          message: "Hesap Kodu ve Bakiye sütunlarının ikisi de eşleştirilmeli.",
        },
      ],
    };
  }

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const issues: ThpRowIssue[] = [];

  const previewRows: ThpPreviewRow[] = rows.map((row, index) => {
    const rowNumber = index + 2; // 1. satır başlık; Excel'deki gibi veri 2'den başlar.
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => (raw[h] = row[i] ?? ""));

    const accountCode = (row[codeIdx] ?? "").trim();
    const accountName = nameIdx >= 0 ? (row[nameIdx] ?? "").trim() : "";
    const balanceRaw = row[balanceIdx] ?? "";
    const dueDateRaw = dueDateIdx >= 0 ? (row[dueDateIdx] ?? "") : "";
    const documentDateRaw = documentDateIdx >= 0 ? (row[documentDateIdx] ?? "") : "";

    if (!accountCode) {
      issues.push({
        rowNumber,
        code: "MISSING_ACCOUNT_CODE",
        message: "Hesap kodu boş.",
      });
      return {
        rowNumber,
        accountCode: null,
        accountName: accountName || null,
        amount: null,
        dueDate: null,
        direction: null,
        categoryId: null,
        categoryName: null,
        mappingConfigId: null,
        layer: null,
        raw,
      };
    }

    // Bakiye HER ZAMAN abs() alınır — işaret ASLA ham değerden çıkarılmaz,
    // SADECE MappingConfig.direction'dan gelir (bkz. dosya başı notu ve
    // treasury-import.service.ts). ERP dışa aktarımları borç/alacak
    // işaretinde tutarsızdır; eşleştirme kuralı tek deklare edilmiş,
    // gözden geçirilebilir kaynaktır.
    const amountRaw = balanceRaw.trim();
    const amount = amountRaw === "" ? null : Math.abs(parseAmount(amountRaw));
    if (amount === null || amount === 0) {
      issues.push({
        rowNumber,
        code: "INVALID_AMOUNT",
        message: `"${balanceRaw}" geçerli bir bakiye değil.`,
      });
    }

    const mappingConfig = resolveThpMapping(accountCode, mappingConfigs);
    if (!mappingConfig) {
      issues.push({
        rowNumber,
        code: "UNMAPPED",
        message: `"${accountCode}" için tanımlı bir THP eşleştirme kuralı yok.`,
      });
      return {
        rowNumber,
        accountCode,
        accountName: accountName || null,
        amount,
        dueDate: null,
        direction: null,
        categoryId: null,
        categoryName: null,
        mappingConfigId: null,
        layer: null,
        raw,
      };
    }

    if (mappingConfig.layer === "ACCRUAL") {
      issues.push({
        rowNumber,
        code: "ACCRUAL_LAYER_SKIPPED",
        message: `Tahakkuk hesabı — nakit olayı üretilmedi (${mappingConfig.accountCode} ${mappingConfig.accountName}).`,
      });
    }

    // Vade tarihi çözümleme sırası: (1) Vade Tarihi hücresi, (2) Belge
    // Tarihi + defaultTermDays, (3) yoksa MISSING_DUE_DATE — ASLA bugüne
    // sessizce varsayılmaz (bkz. thp-mapping.ts dosya başı ve plan notu).
    let dueDate = parseDateLike(dueDateRaw);
    if (!dueDate && documentDateRaw && mappingConfig.defaultTermDays != null) {
      const documentDate = parseDateLike(documentDateRaw);
      if (documentDate) dueDate = addDays(documentDate, mappingConfig.defaultTermDays);
    }
    if (!dueDate && mappingConfig.layer === "CASH") {
      issues.push({
        rowNumber,
        code: "MISSING_DUE_DATE",
        message:
          "Vade tarihi çözümlenemedi (ne Vade Tarihi ne Belge Tarihi+varsayılan vade).",
      });
    }

    const category = categoriesById.get(mappingConfig.categoryId) ?? null;

    return {
      rowNumber,
      accountCode,
      accountName: accountName || null,
      amount,
      dueDate,
      direction: mappingConfig.direction,
      categoryId: mappingConfig.categoryId,
      categoryName: category?.name ?? null,
      mappingConfigId: mappingConfig.id,
      layer: mappingConfig.layer,
      raw,
    };
  });

  return { previewRows, issues };
}
