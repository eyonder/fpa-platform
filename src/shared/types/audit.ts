/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Bütçe hücrelerinde yapılan HER değişikliği eski/yeni değer + kullanıcı
 * bilgisiyle kaydeden denetim (audit) izi.
 */

export type AuditAction = "CREATE" | "UPDATE";

/** Değişikliğin hangi akıştan geldiği — kaynağa göre farklı güven seviyesi/filtre. */
export type AuditSource = "MANUAL_EDIT" | "FORECAST" | "IMPORT" | "PAYROLL" | "EXPENSE";

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: "BudgetLine";
  scenarioId: string;
  categoryId: string;
  /** 1-12 (Ocak-Aralık). */
  month: number;
  fieldName: "amount";
  oldValue: number;
  newValue: number;
  occurredAt: string;
  source: AuditSource;
  /** Görüntüleme için zenginleştirilmiş alanlar — depoda saklanmaz, sadece API yanıtında doldurulur. */
  scenarioName?: string;
  categoryName?: string;
}
