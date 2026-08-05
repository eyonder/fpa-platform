/**
 * Bütçe giriş tablosundaki 12 ay sütununun tek kaynağı.
 * `field` grid satırındaki (m1..m12) alan adıyla, `month` backend'deki
 * 1-12 ay numarasıyla eşleşir.
 */
export const MONTHS = [
  { month: 1, field: "m1", label: "Oca" },
  { month: 2, field: "m2", label: "Şub" },
  { month: 3, field: "m3", label: "Mar" },
  { month: 4, field: "m4", label: "Nis" },
  { month: 5, field: "m5", label: "May" },
  { month: 6, field: "m6", label: "Haz" },
  { month: 7, field: "m7", label: "Tem" },
  { month: 8, field: "m8", label: "Ağu" },
  { month: 9, field: "m9", label: "Eyl" },
  { month: 10, field: "m10", label: "Eki" },
  { month: 11, field: "m11", label: "Kas" },
  { month: 12, field: "m12", label: "Ara" },
] as const;

export type MonthField = (typeof MONTHS)[number]["field"];

export const MONTH_FIELDS = MONTHS.map((m) => m.field) as MonthField[];
