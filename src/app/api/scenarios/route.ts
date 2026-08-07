import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import {
  createScenarioSchema,
  listScenariosSchema,
} from "@/backend/modules/scenarios/scenario.schema";
import { scenarioService } from "@/backend/modules/scenarios/scenario.service";

/**
 * İNCE CONTROLLER.
 * Görevi dört adımdır: bağlamı çöz → yetkiyi doğrula → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 */

export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listScenariosSchema.parse(params);

    return ok(await scenarioService.list(tenantId, query));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "scenario:manage");

    const input = createScenarioSchema.parse(await request.json());

    return ok(await scenarioService.create(context.tenantId, input), 201);
  }),
);
