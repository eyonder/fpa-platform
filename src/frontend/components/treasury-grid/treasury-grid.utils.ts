import type { ProjectionSource } from "@/shared/types";

/** Gün adları — projeksiyon ızgarasında hafta sonu satırlarını soluklaştırmak
 * ve "hangi gün" sorusunu tarihe bakmadan cevaplamak için. */
const WEEKDAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** YYYY-MM-DD -> dd.MM.yyyy (Türkçe okuma biçimi). */
export function formatDateTr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

/** dd.MM.yyyy | dd/MM/yyyy | YYYY-MM-DD -> YYYY-MM-DD; çözülemezse null. */
export function parseDateTr(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const month = m.padStart(2, "0");
  const day = d.padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12) return null;
  if (Number(day) < 1 || Number(day) > 31) return null;
  return `${y}-${month}-${day}`;
}

export const SOURCE_LABEL: Record<ProjectionSource, string> = {
  MANUAL: "Elle",
  THP_IMPORT: "THP",
  BUDGET_DERIVED: "Bütçeden",
  SALES: "Satış",
  PIPELINE: "Pipeline",
  CAPEX: "Capex",
  PAYROLL: "Bordro",
  SIMULATION: "Simülasyon",
};

/** Türetilmiş satırlar Hazine'de düzenlenemez — hangi modüle gidilmesi
 * gerektiğini söyleyen ipucu metni (boş bir "düzenlenemez" mesajından çok
 * daha kullanışlı). */
export const SOURCE_OWNER_HINT: Partial<Record<ProjectionSource, string>> = {
  SALES: "Satış modülünden yönetilir (hakediş faturalama tarihleri).",
  PIPELINE: "Açık pipeline tahminidir — Satış modülünden yönetilir.",
  CAPEX: "Sabit Kıymetler modülünden yönetilir (edinim tarihi).",
  PAYROLL: "Personel modülünden yönetilir (ücret kayıtları).",
  SIMULATION: "Simülasyon satırı — kalıcı değildir.",
  BUDGET_DERIVED:
    "Bütçe satırından ödeme vadesi konvansiyonuyla üretildi — düzenlenebilir, ama yeniden üretimde kaybolur.",
};

export const STATUS_LABEL = {
  PLANNED: "Planlanan",
  NEUTRALIZED: "Nötrlendi",
  CANCELLED: "İptal",
} as const;
