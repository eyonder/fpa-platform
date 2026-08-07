import { assertPermission } from "@/backend/core/authorize";
import { ValidationError } from "@/backend/core/errors";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import {
  ALLOWED_IMPORT_EXTENSIONS,
  MAX_IMPORT_FILE_BYTES,
} from "@/backend/modules/imports/import.schema";
import { importService } from "@/backend/modules/imports/import.service";

/**
 * İNCE CONTROLLER.
 * Görevi dört adımdır: bağlamı çöz → yetkiyi doğrula → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 *
 * POST /api/imports — multipart/form-data: { scenarioId, file }
 * Gövde JSON değil (dosya içerdiği için) — zod yerine burada elle doğrularız.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "import:run");

    const formData = await request.formData();
    const scenarioId = formData.get("scenarioId");
    const file = formData.get("file");

    const fields: Record<string, string[]> = {};
    if (typeof scenarioId !== "string" || !scenarioId) {
      fields.scenarioId = ["Bir senaryo seçmelisiniz."];
    }
    if (!(file instanceof File) || file.size === 0) {
      fields.file = ["Bir dosya seçmelisiniz."];
    } else {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        fields.file = [
          `Dosya en fazla ${MAX_IMPORT_FILE_BYTES / 1024 / 1024}MB olabilir.`,
        ];
      }
      if (
        !ALLOWED_IMPORT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
      ) {
        fields.file = [
          `Sadece ${ALLOWED_IMPORT_EXTENSIONS.join(", ")} dosyaları desteklenir.`,
        ];
      }
    }
    if (Object.keys(fields).length > 0) throw new ValidationError(fields);

    const buffer = Buffer.from(await (file as File).arrayBuffer());

    return ok(
      await importService.create(
        context,
        scenarioId as string,
        (file as File).name,
        buffer,
      ),
      201,
    );
  }),
);
