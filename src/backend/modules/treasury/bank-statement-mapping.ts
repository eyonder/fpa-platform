import { fold } from "@/backend/core/text";
import { parseAmount } from "@/shared/lib/parse-amount";
import type {
  BankColumnMapping,
  BankPreviewRow,
  BankRowIssue,
  BankTargetField,
} from "@/shared/types";

import { parseDateLike } from "./treasury.dates";

/**
 * SAF BANKA EKSTRESİ ÇÖZÜMLEME — `thp-mapping.ts` ile AYNI disiplin
 * (HTTP/Prisma/React bilmez, veritabanı olmadan test edilebilir).
 *
 * THP içe aktarımından FARKI: burada `MappingConfig` kuralı YOKTUR. Banka
 * ekstresi bir hesap planı taşımaz — yön (INFLOW/OUTFLOW) ya AYRI Borç/Alacak
 * kolonlarından ya da TEK tutar kolonunun İŞARETİNDEN gelir. Bu, THP
 * tarafındaki "işaret ASLA ham veriden çıkarılmaz" kuralının BİLİNÇLİ
 * istisnasıdır: orada ham işaret ERP dışa aktarımının borç/alacak
 * kaprisiydi, burada ham işaret bankanın kendi beyanıdır — tek gerçek kaynak.
 */

const HEADER_HINTS: Record<Exclude<BankTargetField, "skip">, string[]> = {
  valueDate: ["valor", "valör", "islem tarihi", "tarih", "value date", "date"],
  description: ["aciklama", "islem aciklamasi", "detay", "description"],
  counterparty: ["karsi taraf", "unvan", "gonderen", "alici", "counterparty"],
  amount: ["tutar", "islem tutari", "amount"],
  debit: ["borc", "cikis", "debit"],
  credit: ["alacak", "giris", "credit"],
  externalRef: ["referans", "dekont", "islem no", "fis no", "reference"],
};

/** Başlıklara bakarak kolon rollerini tahmin eder. `amount` ile
 * `debit`/`credit` BİRLİKTE önerilebilir — çözümleme sırasında borç/alacak
 * çifti varsa O tercih edilir (bkz. resolveBankRows). */
export function suggestBankColumns(headers: string[]): BankColumnMapping[] {
  const used = new Set<BankTargetField>();

  return headers.map((header) => {
    const folded = fold(header);
    let target: BankTargetField = "skip";

    for (const [field, hints] of Object.entries(HEADER_HINTS) as [
      Exclude<BankTargetField, "skip">,
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

/**
 * Ham satırları önizleme satırlarına + sorun listesine çevirir.
 * `existingRefs`, DB'de zaten bulunan referansların kümesidir — mükerrer
 * satırlar HATA değil, `isDuplicate` olarak İŞARETLENİR ve commit'te atlanır
 * (aynı ekstrenin iki kez yüklenmesi sık ve masum bir kullanıcı hatasıdır).
 */
export function resolveBankRows(
  headers: string[],
  rows: string[][],
  mapping: BankColumnMapping[],
  existingRefs: Set<string>,
): { previewRows: BankPreviewRow[]; issues: BankRowIssue[] } {
  const indexOf = (field: BankTargetField) =>
    mapping.findIndex((m) => m.targetField === field);

  const dateIdx = indexOf("valueDate");
  const descIdx = indexOf("description");
  const counterpartyIdx = indexOf("counterparty");
  const amountIdx = indexOf("amount");
  const debitIdx = indexOf("debit");
  const creditIdx = indexOf("credit");
  const refIdx = indexOf("externalRef");

  const hasAmountSource = amountIdx >= 0 || debitIdx >= 0 || creditIdx >= 0;
  if (dateIdx === -1 || !hasAmountSource) {
    return {
      previewRows: [],
      issues: [
        {
          rowNumber: 0,
          code: "MISSING_COLUMNS",
          message:
            "Valör/Tarih sütunu ve en az bir tutar sütunu (Tutar ya da Borç/Alacak) eşleştirilmeli.",
        },
      ],
    };
  }

  const issues: BankRowIssue[] = [];
  // Dosyanın KENDİ İÇİNDEKİ tekrarları da yakalar — DB'dekilerle aynı kovaya.
  const seenRefs = new Set<string>();

  const previewRows: BankPreviewRow[] = rows.map((row, index) => {
    const rowNumber = index + 2; // 1. satır başlık.
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => (raw[h] = row[i] ?? ""));

    const cell = (idx: number) => (idx >= 0 ? (row[idx] ?? "").trim() : "");

    const valueDate = parseDateLike(cell(dateIdx));
    if (!valueDate) {
      issues.push({
        rowNumber,
        code: "MISSING_VALUE_DATE",
        message: `"${cell(dateIdx)}" geçerli bir tarih değil.`,
      });
    }

    // Borç/Alacak ÇİFTİ varsa o kazanır — bankaların çoğu bu biçimi verir ve
    // yönü açıkça beyan eder; tek kolonun işaretini yorumlamaya gerek kalmaz.
    let amount: number | null = null;
    let direction: BankPreviewRow["direction"] = null;

    const debitRaw = cell(debitIdx);
    const creditRaw = cell(creditIdx);

    if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitRaw ? Math.abs(parseAmount(debitRaw)) : 0;
      const credit = creditRaw ? Math.abs(parseAmount(creditRaw)) : 0;
      if (credit > 0) {
        amount = credit;
        direction = "INFLOW";
      } else if (debit > 0) {
        amount = debit;
        direction = "OUTFLOW";
      }
    }

    if (amount === null && amountIdx >= 0) {
      const amountRaw = cell(amountIdx);
      if (amountRaw) {
        const parsed = parseAmount(amountRaw);
        if (parsed !== 0) {
          amount = Math.abs(parsed);
          direction = parsed > 0 ? "INFLOW" : "OUTFLOW";
        }
      }
    }

    if (amount === null || direction === null) {
      issues.push({
        rowNumber,
        code: "INVALID_AMOUNT",
        message: "Tutar okunamadı ya da sıfır (Borç/Alacak ve Tutar sütunları boş).",
      });
    }

    const description = cell(descIdx) || null;
    if (!description) {
      issues.push({
        rowNumber,
        code: "MISSING_DESCRIPTION",
        message: "Açıklama boş — hareket kaydedilebilir ama eşleştirme puanı düşer.",
      });
    }

    const externalRef = cell(refIdx) || null;
    let isDuplicate = false;
    if (externalRef) {
      isDuplicate = existingRefs.has(externalRef) || seenRefs.has(externalRef);
      if (isDuplicate) {
        issues.push({
          rowNumber,
          code: "DUPLICATE_REF",
          message: `"${externalRef}" referansı zaten kayıtlı — bu satır atlanacak.`,
        });
      }
      seenRefs.add(externalRef);
    }

    return {
      rowNumber,
      valueDate,
      amount,
      direction,
      description,
      counterparty: cell(counterpartyIdx) || null,
      externalRef,
      isDuplicate,
      raw,
    };
  });

  return { previewRows, issues };
}
