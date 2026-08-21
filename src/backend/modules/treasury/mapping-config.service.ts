import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import type { MappingConfigEntry } from "@/shared/types";

import { mappingConfigRepository } from "./mapping-config.repository";
import { THP_STARTER_MAPPINGS } from "./thp-starter-set";
import type {
  CreateMappingConfigInput,
  UpdateMappingConfigInput,
} from "./treasury.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `cost-center.service.ts`teki AYNI CRUD + benzersizlik kontrolü deseni —
 * `(tenantId, accountCode)` çifti benzersiz olmalı (bkz. schema.prisma'daki
 * `@@unique`; burası RLS'in ARKASINDAKİ ikinci, kullanıcıya okunabilir hata
 * mesajı veren savunma hattı).
 */
export const mappingConfigService = {
  async list(tenantId: string): Promise<MappingConfigEntry[]> {
    return mappingConfigRepository.findByTenant(tenantId);
  },

  async get(tenantId: string, id: string): Promise<MappingConfigEntry> {
    const entry = await mappingConfigRepository.findById(tenantId, id);
    if (!entry) throw new NotFoundError("Eşleştirme kuralı");
    return entry;
  },

  async create(
    context: RequestContext,
    input: CreateMappingConfigInput,
  ): Promise<MappingConfigEntry> {
    await assertCategoryExists(context.tenantId, input.categoryId);
    await assertAccountCodeAvailable(context.tenantId, input.accountCode);
    return mappingConfigRepository.create(context.tenantId, context.userId, input);
  },

  async update(
    context: RequestContext,
    id: string,
    input: UpdateMappingConfigInput,
  ): Promise<MappingConfigEntry> {
    const current = await this.get(context.tenantId, id);

    if (input.categoryId !== undefined)
      await assertCategoryExists(context.tenantId, input.categoryId);
    if (input.accountCode !== undefined && input.accountCode !== current.accountCode) {
      await assertAccountCodeAvailable(context.tenantId, input.accountCode);
    }

    const updated = await mappingConfigRepository.update(context.tenantId, id, input);
    if (!updated) throw new NotFoundError("Eşleştirme kuralı");
    return updated;
  },

  async delete(context: RequestContext, id: string): Promise<void> {
    const deleted = await mappingConfigRepository.delete(context.tenantId, id);
    if (!deleted) throw new NotFoundError("Eşleştirme kuralı");
  },

  /** "Varsayılan THP setini yükle" — boş bir eşleştirme ekranıyla tek başına
   * bırakmak yerine kullanıcıya gerçek, düzenlenebilir bir başlangıç noktası
   * verir (bkz. thp-starter-set.ts dosya başı notu). */
  async seedDefaults(context: RequestContext): Promise<MappingConfigEntry[]> {
    return mappingConfigRepository.seedDefaults(
      context.tenantId,
      context.userId,
      THP_STARTER_MAPPINGS,
    );
  },
};

async function assertCategoryExists(
  tenantId: string,
  categoryId: string,
): Promise<void> {
  const categories = await budgetLineRepository.findCategories(tenantId);
  if (!categories.some((c) => c.id === categoryId)) {
    throw new AppError(
      "MAPPING_CATEGORY_NOT_FOUND",
      `"${categoryId}" adında bir bütçe kategorisi bulunamadı.`,
      404,
    );
  }
}

async function assertAccountCodeAvailable(
  tenantId: string,
  accountCode: string,
): Promise<void> {
  const existing = await mappingConfigRepository.findByAccountCode(
    tenantId,
    accountCode,
  );
  if (existing) {
    throw new AppError(
      "MAPPING_ACCOUNT_CODE_TAKEN",
      `"${accountCode}" hesap kodu için zaten bir eşleştirme kuralı var.`,
      409,
    );
  }
}
