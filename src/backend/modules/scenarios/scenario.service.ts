import { AppError, NotFoundError } from "@/backend/core/errors";
import type { Scenario } from "@/shared/types";

import { scenarioRepository } from "./scenario.repository";
import type { CreateScenarioInput, ListScenariosQuery } from "./scenario.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 * Bu sayede yarın backend NestJS'e taşınırsa bu dosya olduğu gibi kopyalanır.
 */
export const scenarioService = {
  async list(tenantId: string, query: ListScenariosQuery): Promise<Scenario[]> {
    return scenarioRepository.findMany(tenantId, query);
  },

  async create(tenantId: string, input: CreateScenarioInput): Promise<Scenario> {
    const duplicate = await scenarioRepository.findByName(tenantId, input.name);
    if (duplicate) {
      throw new AppError(
        "SCENARIO_NAME_TAKEN",
        `"${input.name}" adında bir senaryo zaten var. Farklı bir ad seçin.`,
        409,
      );
    }

    return scenarioRepository.create(tenantId, input);
  },

  /**
   * Kilitleme/kilit açma: pratikteki "onay" adımıdır — Bütçe Yöneticisi/Admin
   * verileri (elle girilmiş, forecast'ten gelmiş ya da import edilmiş) gözden
   * geçirip senaryoyu kilitleyince, o andan sonra hiçbir yol (manuel düzenleme,
   * forecast, import) o senaryoya yazamaz (bkz. budget-line.service.ts).
   */
  async setLocked(tenantId: string, id: string, isLocked: boolean): Promise<Scenario> {
    const updated = await scenarioRepository.setLocked(tenantId, id, isLocked);
    if (!updated) throw new NotFoundError("Senaryo");
    return updated;
  },
};
