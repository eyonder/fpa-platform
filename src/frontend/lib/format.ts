/** Finansal sayı ve tarih biçimlendirme. UI genelinde tutarlılık için tek kaynak. */

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number, currency?: string): string {
  const formatted = numberFormatter.format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

const compactFormatter = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Grafik eksenleri gibi dar alanlar için: 1.250.000 -> "1,3 Mn". */
export function formatCompactAmount(value: number): string {
  return compactFormatter.format(value);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Denetim kaydı gibi saniye hassasiyeti gereken yerler için (tarih + saat). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
