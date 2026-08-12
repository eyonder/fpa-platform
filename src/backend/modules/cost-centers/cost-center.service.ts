import { AppError, NotFoundError } from "@/backend/core/errors";
import type { AllocationKey, CostCenter } from "@/shared/types";

import { allocationKeyRepository } from "./allocation-key.repository";
import { costCenterRepository } from "./cost-center.repository";
import type {
  CreateCostCenterInput,
  UpdateCostCenterInput,
  UpsertAllocationKeyInput,
} from "./cost-center.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 */
export const costCenterService = {
  async list(tenantId: string): Promise<CostCenter[]> {
    return costCenterRepository.findByTenant(tenantId);
  },

  async get(tenantId: string, id: string): Promise<CostCenter> {
    const costCenter = await costCenterRepository.findById(tenantId, id);
    if (!costCenter) throw new NotFoundError("Gider merkezi");
    return costCenter;
  },

  async create(tenantId: string, input: CreateCostCenterInput): Promise<CostCenter> {
    await assertCodeAvailable(tenantId, input.code);

    if (input.parentCostCenterId) {
      await this.get(tenantId, input.parentCostCenterId); // yoksa 404
    }

    return costCenterRepository.create(tenantId, input);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateCostCenterInput,
  ): Promise<CostCenter> {
    const current = await this.get(tenantId, id); // yoksa 404

    if (input.code !== undefined && input.code !== current.code) {
      await assertCodeAvailable(tenantId, input.code);
    }

    if (input.parentCostCenterId !== undefined && input.parentCostCenterId !== null) {
      if (input.parentCostCenterId === id) {
        throw new AppError(
          "COST_CENTER_CYCLE",
          "Bir gider merkezi kendi üst merkezi olamaz.",
          422,
        );
      }
      await this.get(tenantId, input.parentCostCenterId); // yoksa 404

      const descendants = await costCenterRepository.findDescendants(tenantId, id);
      if (descendants.some((d) => d.id === input.parentCostCenterId)) {
        throw new AppError(
          "COST_CENTER_CYCLE",
          "Bir gider merkezi kendi alt ağacındaki bir merkeze taşınamaz (döngü oluşur).",
          422,
        );
      }
    }

    const updated = await costCenterRepository.update(tenantId, id, input);
    if (!updated) throw new NotFoundError("Gider merkezi");
    return updated;
  },

  async getAllocationKey(
    tenantId: string,
    costCenterId: string,
  ): Promise<AllocationKey | null> {
    await this.get(tenantId, costCenterId); // yoksa 404
    return allocationKeyRepository.findBySourceCostCenter(tenantId, costCenterId);
  },

  /** Oluşturur ya da (varsa) üye listesini TAMAMEN değiştirir — bkz. allocation-key.repository.ts. */
  async setAllocationKey(
    tenantId: string,
    costCenterId: string,
    input: UpsertAllocationKeyInput,
  ): Promise<AllocationKey> {
    await this.get(tenantId, costCenterId); // yoksa 404

    for (const member of input.members) {
      if (member.costCenterId === costCenterId) {
        throw new AppError(
          "ALLOCATION_KEY_SELF_MEMBER",
          "Bir gider merkezi kendi tahsis anahtarının üyesi olamaz.",
          422,
        );
      }
      await this.get(tenantId, member.costCenterId); // yoksa 404
    }

    return allocationKeyRepository.upsert(tenantId, costCenterId, input);
  },
};

async function assertCodeAvailable(tenantId: string, code: string): Promise<void> {
  const duplicate = await costCenterRepository.findByCode(tenantId, code);
  if (duplicate) {
    throw new AppError(
      "COST_CENTER_CODE_TAKEN",
      `"${code}" koduyla bir gider merkezi zaten var. Farklı bir kod seçin.`,
      409,
    );
  }
}
