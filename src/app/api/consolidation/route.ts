import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { getRequestContext } from "@/backend/core/tenant";
import { consolidateSchema } from "@/backend/modules/consolidation/consolidation.schema";
import { consolidationService } from "@/backend/modules/consolidation/consolidation.service";

/**
 * İNCE CONTROLLER.
 * Görevi dört adımdır: bağlamı çöz → yetkiyi doğrula → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 *
 * GET /api/consolidation
 *   ?parentOrganizationId=org-holding&fiscalYear=2026&periodStart=1&periodEnd=12
 *   &scenarioKind=BUDGET&asOfDate=2026-08-06
 *
 * Not: parentOrganizationId, isteği yapan tenant'ın (x-tenant-id) KENDİSİ
 * olmalı — bkz. consolidation.service.ts'teki yetki kontrolü. RBAC (rol)
 * kontrolü ayrı bir katman: tenant doğru olsa bile DATA_ENTRY konsolidasyon
 * çalıştıramaz.
 */
export const GET = handleRoute(async (request: Request) => {
  const context = await getRequestContext(request);
  assertPermission(context.role, "consolidation:run");

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = consolidateSchema.parse(params);

  return ok(await consolidationService.consolidate(context.tenantId, query));
});
