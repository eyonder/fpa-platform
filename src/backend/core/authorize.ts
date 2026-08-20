import type { Role } from "@/shared/types";

import { ForbiddenError } from "./errors";

/**
 * RBAC İZİN TABLOSU.
 *
 * Roller: ADMIN, BUDGET_MANAGER (Bütçe Yöneticisi), DATA_ENTRY (Veri Giriş Uzmanı).
 * İzinler tek bir yerde tanımlanır; route'lar SADECE `assertPermission` çağırır,
 * hiçbir yerde "if (role === 'ADMIN')" gibi dağınık kontrol OLMAZ — rol
 * eklendiğinde/değiştiğinde tek dokunacağınız yer burasıdır.
 */
export type Permission =
  /** Senaryo oluşturma. */
  | "scenario:manage"
  /** Senaryoyu kilitleme/kilit açma — bkz. Scenario.isLocked notu: bu, veri
   *  girişini "onaylama/kapatma" mekanizmasıdır. */
  | "scenario:lock"
  /** Bütçe hücrelerini yazma (manuel düzenleme, forecast/import commit). */
  | "budget-line:write"
  /** Büyüme oranlı forecast üretme (önizleme dahil). */
  | "forecast:run"
  /** Çok şirketli konsolidasyon raporu çalıştırma. */
  | "consolidation:run"
  /** Mizan/Muavin dosyası yükleme, eşleştirme, onaylama. */
  | "import:run"
  /** Denetim (audit) kaydını görüntüleme. */
  | "audit:read"
  /** Personel/maaş verisini görüntüleme (bordro önizleme dahil). */
  | "payroll:read"
  /** Personel ekleme/düzenleme, ücret kaydı girme, bordroyu bütçeye yazma. */
  | "payroll:write"
  /** Gider merkezi / tahsis anahtarı oluşturma-düzenleme. */
  | "cost-center:write"
  /** Taslak gider kaydı oluşturma/düzenleme, onaya gönderme. */
  | "expense-entry:write"
  /** Onaya gönderilmiş gider kaydını onaylama/reddetme, bütçeye yazma. */
  | "expense-entry:approve"
  /** Taslak sabit kıymet (capex) kaydı oluşturma/düzenleme, onaya gönderme. */
  | "fixed-asset:write"
  /** Onaya gönderilmiş sabit kıymeti onaylama/reddetme, amortismanı bütçeye yazma. */
  | "fixed-asset:approve"
  /** Satış fırsatı oluşturma/düzenleme, kapatma (WON/LOST) — rutin CRM veri girişi. */
  | "sales-opportunity:write"
  /** Kazanılan (WON) fırsatları (actuals) ya da açık boru hattını (pipeline
   *  forecast) bütçeye yazma. */
  | "sales-opportunity:commit";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "scenario:manage",
    "scenario:lock",
    "budget-line:write",
    "forecast:run",
    "consolidation:run",
    "import:run",
    "audit:read",
    "payroll:read",
    "payroll:write",
    "cost-center:write",
    "expense-entry:write",
    "expense-entry:approve",
    "fixed-asset:write",
    "fixed-asset:approve",
    "sales-opportunity:write",
    "sales-opportunity:commit",
  ],
  // ÖNEMLİ: payroll:read/payroll:write BİLEREK burada YOK. Maaş verisi
  // gizliliği (bkz. Employee/EmployeeCompensation RLS + şifreleme notu,
  // prisma/schema.prisma) sadece ADMIN'e (HR/Admin) açıktır — bu,
  // uygulamadaki İLK gerçek ADMIN/BUDGET_MANAGER izin ayrımıdır.
  BUDGET_MANAGER: [
    "scenario:manage",
    "scenario:lock",
    "budget-line:write",
    "forecast:run",
    "consolidation:run",
    "import:run",
    "audit:read",
    "cost-center:write",
    "expense-entry:write",
    "expense-entry:approve",
    "fixed-asset:write",
    "fixed-asset:approve",
    "sales-opportunity:write",
    "sales-opportunity:commit",
  ],
  // Veri Giriş Uzmanı: sadece veri girer (elle ya da dosyayla). Senaryo
  // yönetemez, kilit açamaz/kapatamaz, forecast/konsolidasyon çalıştıramaz,
  // denetim kaydını göremez (bu, Bütçe Yöneticisi/Admin'in gözetim aracıdır).
  // expense-entry:approve/fixed-asset:approve BİLEREK YOK — kendi gönderdiği
  // gideri/sabit kıymeti kendisi onaylayamasın diye (bkz. expense-entry.service.ts
  // ve fixed-asset.service.ts'teki onay akışı notu). sales-opportunity:write
  // İSE BİLEREK VAR — diğer modüllerin AKSİNE, satış fırsatı girişi/kapatma
  // rutin CRM veri girişidir, ayrıcalıklı bir onay adımı değil; yalnızca
  // bütçeye YAZMA (:commit) ADMIN/BÜTÇE Yöneticisi'ne özel kalır.
  DATA_ENTRY: [
    "budget-line:write",
    "import:run",
    "expense-entry:write",
    "fixed-asset:write",
    "sales-opportunity:write",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

const PERMISSION_LABELS: Record<Permission, string> = {
  "scenario:manage": "senaryo yönetimi",
  "scenario:lock": "senaryo kilitleme/açma",
  "budget-line:write": "bütçe verisi girişi",
  "forecast:run": "forecast üretme",
  "consolidation:run": "konsolidasyon çalıştırma",
  "import:run": "dosya içe aktarma",
  "audit:read": "denetim kaydını görüntüleme",
  "payroll:read": "personel/maaş verisini görüntüleme",
  "payroll:write": "personel/bordro işlemleri",
  "cost-center:write": "gider merkezi/tahsis anahtarı yönetimi",
  "expense-entry:write": "gider kaydı girişi",
  "expense-entry:approve": "gider kaydı onaylama",
  "fixed-asset:write": "sabit kıymet (capex) girişi",
  "fixed-asset:approve": "sabit kıymet onaylama",
  "sales-opportunity:write": "satış fırsatı girişi",
  "sales-opportunity:commit": "satış tutarını bütçeye yazma",
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BUDGET_MANAGER: "Bütçe Yöneticisi",
  DATA_ENTRY: "Veri Giriş Uzmanı",
};

/** Yetkisizse ForbiddenError fırlatır. Route handler'larda getRequestContext'ten hemen sonra çağrılır. */
export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(
      `${ROLE_LABELS[role]} rolü "${PERMISSION_LABELS[permission]}" işlemini yapamaz.`,
    );
  }
}
