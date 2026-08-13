import type { FixedAssetCategory } from "@/shared/types";

/** Görüntüleme etiketleri — backend/modules/fixed-assets/fixed-asset.schema.ts'teki
 * enum değerleriyle tutarlı tutun. */
export const CATEGORY_LABEL: Record<FixedAssetCategory, string> = {
  BUILDINGS: "Binalar",
  MACHINERY_EQUIPMENT: "Makine ve Teçhizat",
  VEHICLES: "Taşıtlar",
  FURNITURE_FIXTURES: "Demirbaşlar",
  COMPUTER_HARDWARE: "Bilgisayar/Donanım",
  LEASEHOLD_IMPROVEMENTS: "Özel Maliyetler (Kiralık İyileştirme)",
};
