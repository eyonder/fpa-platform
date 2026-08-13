import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { toMinorUnits } from "@/shared/lib/money";
import type {
  CreateFixedAssetInput,
  DepreciationScheduleMonth,
  FixedAsset,
  FixedAssetCategory,
  FixedAssetFeasibility,
  UpdateFixedAssetInput,
  VukAmortismanConfigEntry,
} from "@/shared/types";

import { generateDepreciationSchedule } from "./depreciation-schedule";
import type { ListFixedAssetsQuery } from "./fixed-asset.schema";
import { fixedAssetRepository } from "./fixed-asset.repository";
import { computeIrr, computeNpvMinor } from "./npv-irr";
import { vukAmortismanConfigRepository } from "./vuk-amortisman-config.repository";

/**
 * İŞ MANTIĞI KATMANI (Service) — onay akışı durum makinesi.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Akış: DRAFT/REJECTED -[submit]-> SUBMITTED -[approve]-> APPROVED
 *                                  \-[reject]--> REJECTED (tekrar düzenlenip gönderilebilir)
 * `expense-entry.service.ts`'teki AYNI desen — SADECE COMMITTED durumu YOK
 * (bkz. prisma/schema.prisma'daki 12. bölüm notu: amortisman birden çok mali
 * yıla yayılır, tek bir "commit anı" yoktur — bkz. depreciation.service.ts).
 */
export const fixedAssetService = {
  async list(tenantId: string, query: ListFixedAssetsQuery): Promise<FixedAsset[]> {
    return fixedAssetRepository.findByTenant(tenantId, query);
  },

  async get(tenantId: string, id: string): Promise<FixedAsset> {
    const asset = await fixedAssetRepository.findById(tenantId, id);
    if (!asset) throw new NotFoundError("Sabit kıymet");
    return asset;
  },

  async create(tenantId: string, input: CreateFixedAssetInput): Promise<FixedAsset> {
    assertOverrideAllowed(input.category, input.usefulLifeYearsOverride);
    return fixedAssetRepository.create(tenantId, input);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateFixedAssetInput,
  ): Promise<FixedAsset> {
    const current = await this.get(tenantId, id);
    assertEditable(current);

    const category = input.category ?? current.category;
    const override =
      input.usefulLifeYearsOverride !== undefined
        ? input.usefulLifeYearsOverride
        : (current.usefulLifeYearsOverride ?? undefined);
    assertOverrideAllowed(category, override);

    const updated = await fixedAssetRepository.update(tenantId, id, input);
    if (!updated) throw new NotFoundError("Sabit kıymet");
    return updated;
  },

  async submit(context: RequestContext, id: string): Promise<FixedAsset> {
    const asset = await this.get(context.tenantId, id);
    assertEditable(asset);

    const updated = await fixedAssetRepository.transitionToSubmitted(
      context.tenantId,
      id,
      context.userId,
      context.userName,
    );
    if (!updated) throw new NotFoundError("Sabit kıymet");
    return updated;
  },

  async approve(context: RequestContext, id: string): Promise<FixedAsset> {
    const asset = await this.get(context.tenantId, id);
    assertSubmitted(asset);

    const updated = await fixedAssetRepository.transitionToApproved(
      context.tenantId,
      id,
      context.userId,
      context.userName,
    );
    if (!updated) throw new NotFoundError("Sabit kıymet");
    return updated;
  },

  async reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<FixedAsset> {
    const asset = await this.get(context.tenantId, id);
    assertSubmitted(asset);

    const updated = await fixedAssetRepository.transitionToRejected(
      context.tenantId,
      id,
      context.userId,
      context.userName,
      reason,
    );
    if (!updated) throw new NotFoundError("Sabit kıymet");
    return updated;
  },

  /** NPV/IRR — HER istekte yeniden hesaplanır, hiçbir yerde saklanmaz (bkz.
   * prisma/schema.prisma'daki FixedAsset yorumu). Herhangi bir durumda
   * (DRAFT dahil) görüntülenebilir — talep eden taslak hazırlarken, onaylayan
   * karar verirken görür. */
  async feasibility(tenantId: string, id: string): Promise<FixedAssetFeasibility> {
    const asset = await this.get(tenantId, id);

    const cashFlows = [
      { year: 0, amountMinor: -toMinorUnits(asset.baseValue) },
      ...asset.cashFlowProjection.map((cf) => ({
        year: cf.year,
        amountMinor: toMinorUnits(cf.amount),
      })),
    ];

    const npvMinor = computeNpvMinor(cashFlows, asset.discountRate);
    const irr = computeIrr(cashFlows);

    return { npv: npvMinor / 100, irr };
  },

  async schedule(tenantId: string, id: string): Promise<DepreciationScheduleMonth[]> {
    const asset = await this.get(tenantId, id);
    const vukConfigByCategory = await loadVukConfigMap();
    const { annualRate, usefulLifeYears } = resolveDepreciationParams(
      asset.category,
      asset.usefulLifeYearsOverride,
      vukConfigByCategory,
    );

    const acquisition = new Date(asset.acquisitionDate);
    const entries = generateDepreciationSchedule({
      baseValueMinor: toMinorUnits(asset.baseValue),
      annualRate,
      usefulLifeYears,
      acquisitionYear: acquisition.getUTCFullYear(),
      acquisitionMonth: acquisition.getUTCMonth() + 1,
    });

    return entries.map((e) => ({
      year: e.year,
      month: e.month,
      sequenceNumber: e.sequenceNumber,
      amount: e.amountMinor / 100,
    }));
  },
};

function assertEditable(asset: FixedAsset): void {
  if (asset.status !== "DRAFT" && asset.status !== "REJECTED") {
    throw new AppError(
      "FIXED_ASSET_NOT_EDITABLE",
      "Bu sabit kıymet yalnızca taslak ya da reddedilmiş durumdayken düzenlenebilir.",
      409,
    );
  }
}

function assertSubmitted(asset: FixedAsset): void {
  if (asset.status !== "SUBMITTED") {
    throw new AppError(
      "FIXED_ASSET_NOT_SUBMITTED",
      "Bu işlem yalnızca onaya gönderilmiş sabit kıymetler için yapılabilir.",
      409,
    );
  }
}

/** SADECE LEASEHOLD_IMPROVEMENTS için anlamlıdır — diğer beş kategorinin
 * oranı doğrudan yasal zorunluluktur, iş takdirine YER YOK. */
function assertOverrideAllowed(
  category: FixedAssetCategory,
  usefulLifeYearsOverride: number | undefined,
): void {
  if (usefulLifeYearsOverride !== undefined && category !== "LEASEHOLD_IMPROVEMENTS") {
    throw new AppError(
      "FIXED_ASSET_OVERRIDE_NOT_ALLOWED",
      "Faydalı ömür geçersiz kılma (override) sadece Özel Maliyetler (kiralık iyileştirme) için kullanılabilir.",
      422,
    );
  }
}

/** VUK varsayılanını YA DA (SADECE Özel Maliyetler için) kiracının verdiği
 * sözleşme süresini kullanır — bkz. dosya başı ve schema yorumları. */
export function resolveDepreciationParams(
  category: FixedAssetCategory,
  usefulLifeYearsOverride: number | null | undefined,
  vukConfigByCategory: Map<FixedAssetCategory, VukAmortismanConfigEntry>,
): { annualRate: number; usefulLifeYears: number } {
  if (usefulLifeYearsOverride) {
    return {
      annualRate: 1 / usefulLifeYearsOverride,
      usefulLifeYears: usefulLifeYearsOverride,
    };
  }

  const config = vukConfigByCategory.get(category);
  if (!config) {
    throw new AppError(
      "VUK_CONFIG_MISSING",
      `"${category}" kategorisi için VUK amortisman oranı tanımlı değil.`,
      409,
    );
  }
  return { annualRate: config.annualRate, usefulLifeYears: config.usefulLifeYears };
}

export async function loadVukConfigMap(): Promise<
  Map<FixedAssetCategory, VukAmortismanConfigEntry>
> {
  const rows = await vukAmortismanConfigRepository.findAll();
  return new Map(rows.map((r) => [r.category, r]));
}
