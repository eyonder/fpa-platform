/**
 * Saf tarih yardımcıları — uygulama genelinde ortak bir `dates.ts` YOK
 * (her modül kendi küçük tarih fonksiyonlarını yazar, bkz. payroll.service.ts
 * ve cash-flow.service.ts'teki [artık silinmiş] örnekler); bu dosya Hazine
 * modülünün THP içe aktarımı (Faz 4.2) için ihtiyaç duyduğu minimal seti içerir.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

/**
 * "2026-09-15", "2026-09-15T00:00:00.000Z" (ExcelJS'in Date hücrelerini
 * `toISOString()` ile metne çevirdiği biçim) ve "15.09.2026"/"15/09/2026"
 * biçimlerini YYYY-MM-DD'ye çevirir. Çözümlenemezse null — ASLA bugüne
 * varsayılan atanmaz (bkz. thp-mapping.ts'teki vade tarihi notu).
 */
export function parseDateLike(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(ISO_DATE_RE);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m}-${d}`;
  }

  const dmyMatch = trimmed.match(DMY_RE);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    if (
      Number(month) >= 1 &&
      Number(month) <= 12 &&
      Number(day) >= 1 &&
      Number(day) <= 31
    ) {
      return `${y}-${month}-${day}`;
    }
  }

  return null;
}

/** YYYY-MM-DD + gün sayısı -> YYYY-MM-DD (UTC, DST kayması riski yok). */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
