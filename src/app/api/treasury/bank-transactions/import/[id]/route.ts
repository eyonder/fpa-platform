import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { bankImportService } from "@/backend/modules/treasury/bank-import.service";
import { bankRemapSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET   /api/treasury/bank-transactions/import/[id] — önizlemeyi YENİDEN hesaplar.
 * PATCH /api/treasury/bank-transactions/import/[id] — kolon eşleştirmesini
 *   değiştirir (dosyayı TEKRAR yüklemeye gerek yok, rawGrid saklıdır).
 */
type Params = { params: Promise<{ id: string }> };

export const GET = handleRoute((request: Request, { params }: Params) =>
  withTenantContext(request, async (context) => {
    const { id } = await params;
    return ok(await bankImportService.get(context, id));
  }),
);

export const PATCH = handleRoute((request: Request, { params }: Params) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-bank:write");
    const { id } = await params;
    const { mapping } = bankRemapSchema.parse(await request.json());
    return ok(await bankImportService.remap(context, id, mapping));
  }),
);
