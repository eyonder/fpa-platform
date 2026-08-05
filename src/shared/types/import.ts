/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Mizan/Muavin CSV veya Excel içe aktarma sihirbazı: yükle -> kolon eşle
 * (data mapping) -> önizle -> onayla.
 */

export type ImportStatus = "PENDING_REVIEW" | "COMMITTED";

/** Yüklenen dosyadaki bir kolonun bizim şemamızdaki karşılığı. */
export type ImportTargetField = "categoryId" | "month" | "amount" | "skip";

export interface ImportColumnMapping {
  /** Dosyadaki başlık metni (birebir). */
  sourceColumn: string;
  targetField: ImportTargetField;
}

export interface ImportRowIssue {
  /** 0 = satıra özel değil, genel/mapping hatası. Diğerleri dosyadaki satır no (başlık=1). */
  rowNumber: number;
  message: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  categoryId: string | null;
  categoryName: string | null;
  month: number | null;
  amount: number | null;
  /** Dosyadaki ham hücreler, başlık -> değer. Hata ayıklama/denetim için. */
  raw: Record<string, string>;
}

export interface ImportBatch {
  id: string;
  tenantId: string;
  scenarioId: string;
  fileName: string;
  status: ImportStatus;
  detectedColumns: string[];
  suggestedMapping: ImportColumnMapping[];
  appliedMapping: ImportColumnMapping[];
  rows: ImportPreviewRow[];
  issues: ImportRowIssue[];
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string;
  committedAt: string | null;
}
