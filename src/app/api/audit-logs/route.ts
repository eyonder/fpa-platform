import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { listAuditLogsSchema } from "@/backend/modules/audit/audit.schema";
import { auditService } from "@/backend/modules/audit/audit.service";

/**
 * İNCE CONTROLLER.
 * Görevi dört adımdır: bağlamı çöz → yetkiyi doğrula → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 *
 * GET /api/audit-logs?scenarioId=... (opsiyonel filtre)
 * Sadece audit:read izni olan roller (Admin, Bütçe Yöneticisi) görebilir —
 * Veri Giriş Uzmanı kendi girdiği veriyi görür ama denetim izini göremez.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "audit:read");

    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listAuditLogsSchema.parse(params);

    return ok(await auditService.list(context.tenantId, query));
  }),
);
