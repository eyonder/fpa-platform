import { parseAmount } from "@/shared/lib/parse-amount";
import type {
  BudgetCategory,
  ImportColumnMapping,
  ImportPreviewRow,
  ImportRowIssue,
  ImportTargetField,
} from "@/shared/types";

/**
 * Mizan/Muavin dosyalarındaki başlıklar ve hesap adları bizim şemamızla
 * BİREBİR uyuşmaz ("Maaş Giderleri" vs "Personel Giderleri" gibi). Bu dosya
 * o boşluğu dolduran eşleştirme/çözümleme mantığını içerir; import.service.ts
 * bunu HTTP'den bağımsız, test edilebilir saf fonksiyonlar olarak çağırır.
 */

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Türkçe'ye özgü harfleri ASCII karşılığına indirger (ş->s, ı->i, ğ->g, ü->u,
 * ö->o, ç->c). Eş anlamlı tablosunu (ve ay adlarını) TEK bir ASCII biçiminde
 * tutup hem onu hem gelen veriyi bu fonksiyondan geçirerek karşılaştırıyoruz
 * — "maaş" yazan ama sözlükte sadece "maas" olan bir kaydın SESSİZCE
 * eşleşmemesi gibi hataları yapısal olarak önler (bkz. commit sonrası
 * doğrulama testi: bu tam olarak başımıza gelmişti, aksanlı/aksansız her
 * varyantı elle listelemek yerine tek bir katlama fonksiyonuna geçildi).
 */
function foldTurkish(text: string): string {
  return text
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

// export edilir — treasury/thp-mapping.ts AYNI Türkçe katlama davranışına
// ihtiyaç duyuyor (THP hesap adı eşleştirmesi için), kod tekrarı yerine.
export function fold(text: string): string {
  return foldTurkish(normalize(text));
}

const HEADER_HINTS: Record<Exclude<ImportTargetField, "skip">, string[]> = {
  categoryId: ["kategori", "hesap adi", "hesap ad", "hesap", "account"],
  month: ["ay", "donem", "month", "period", "tarih"],
  amount: ["tutar", "bakiye", "borc", "alacak", "amount"],
};

/** Başlık metinlerine bakarak hangi kolonun kategori/ay/tutar olduğunu tahmin eder. */
export function suggestMapping(headers: string[]): ImportColumnMapping[] {
  const used = new Set<ImportTargetField>();

  return headers.map((header) => {
    const folded = fold(header);
    let target: ImportTargetField = "skip";

    for (const [field, hints] of Object.entries(HEADER_HINTS) as [
      Exclude<ImportTargetField, "skip">,
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

/** Gerçek Mizan/Muavin hesap adı varyantları -> bizim kategori id'lerimiz (ASCII-katlanmış). */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  "cat-gelir": [
    "satis geliri",
    "yurtici satislar",
    "yurtdisi satislar",
    "hasilat",
    "gelir",
  ],
  "cat-personel": [
    "personel giderleri",
    "maas giderleri",
    "ucret giderleri",
    "personel",
  ],
  "cat-pazarlama": ["pazarlama giderleri", "reklam giderleri", "pazarlama"],
  "cat-kira": ["kira giderleri", "kira ve ofis", "kira"],
  "cat-saas": ["yazilim giderleri", "saas", "lisans giderleri", "yazilim"],
  "cat-seyahat": ["seyahat giderleri", "yol giderleri", "seyahat"],
  "cat-diger": [
    "diger giderler",
    "cesitli giderler",
    "genel yonetim giderleri",
    "muhtelif giderler",
  ],
};

function matchCategory(
  rawValue: string,
  categories: BudgetCategory[],
): BudgetCategory | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const byId = categories.find((c) => c.id === trimmed);
  if (byId) return byId;

  const folded = fold(trimmed);
  if (!folded) return null;

  const exact = categories.find((c) => fold(c.name) === folded);
  if (exact) return exact;

  for (const category of categories) {
    const synonyms = CATEGORY_SYNONYMS[category.id] ?? [];
    if (
      synonyms.some((s) => folded === s || folded.includes(s) || s.includes(folded))
    ) {
      return category;
    }
  }

  return null;
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
};

function resolveMonth(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12) return asNumber;

  const byName = MONTH_NAME_TO_NUMBER[fold(trimmed)];
  if (byName) return byName;

  // "2026-03", "03.2026", "2026/03" gibi tarih/dönem biçimleri.
  const dateMatch = trimmed.match(/(\d{4})[.\-/](\d{1,2})|(\d{1,2})[.\-/](\d{4})/);
  if (dateMatch) {
    const month = dateMatch[2] ? Number(dateMatch[2]) : Number(dateMatch[3]);
    if (month >= 1 && month <= 12) return month;
  }

  return null;
}

/** Uygulanan eşleştirmeye göre ham satırları önizleme satırlarına + hata listesine çevirir. */
export function resolveRows(
  headers: string[],
  rows: string[][],
  mapping: ImportColumnMapping[],
  categories: BudgetCategory[],
): { previewRows: ImportPreviewRow[]; issues: ImportRowIssue[] } {
  const categoryColIdx = mapping.findIndex((m) => m.targetField === "categoryId");
  const monthColIdx = mapping.findIndex((m) => m.targetField === "month");
  const amountColIdx = mapping.findIndex((m) => m.targetField === "amount");

  if (categoryColIdx === -1 || monthColIdx === -1 || amountColIdx === -1) {
    return {
      previewRows: [],
      issues: [
        {
          rowNumber: 0,
          message: "Kategori, Ay ve Tutar sütunlarının hepsi eşleştirilmeli.",
        },
      ],
    };
  }

  const issues: ImportRowIssue[] = [];

  const previewRows: ImportPreviewRow[] = rows.map((row, index) => {
    const rowNumber = index + 2; // 1. satır başlık; Excel'deki gibi veri 2'den başlar.
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => (raw[h] = row[i] ?? ""));

    const categoryRaw = row[categoryColIdx] ?? "";
    const monthRaw = row[monthColIdx] ?? "";
    const amountRaw = row[amountColIdx] ?? "";

    const category = matchCategory(categoryRaw, categories);
    const month = resolveMonth(monthRaw);
    const amount = amountRaw.trim() === "" ? null : parseAmount(amountRaw);

    if (!category) {
      issues.push({
        rowNumber,
        message: `"${categoryRaw}" bilinen bir kategoriyle eşleşmedi.`,
      });
    }
    if (month === null) {
      issues.push({ rowNumber, message: `"${monthRaw}" geçerli bir ay değil.` });
    }
    if (amount === null) {
      issues.push({ rowNumber, message: "Tutar boş." });
    }

    return {
      rowNumber,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      month,
      amount,
      raw,
    };
  });

  return { previewRows, issues };
}
