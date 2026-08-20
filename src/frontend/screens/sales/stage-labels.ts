import type { SalesOpportunityStage } from "@/shared/types";

/** Görüntüleme etiketleri — backend/modules/sales/sales.schema.ts'teki enum
 * değerleriyle tutarlı tutun (bkz. fixed-assets/category-labels.ts ile AYNI desen). */
export const STAGE_LABEL: Record<SalesOpportunityStage, string> = {
  LEAD: "Aday",
  QUALIFIED: "Nitelikli",
  PROPOSAL: "Teklif",
  NEGOTIATION: "Müzakere",
  WON: "Kazanıldı",
  LOST: "Kaybedildi",
};

export const STAGE_TONE: Record<SalesOpportunityStage, "neutral" | "ledger" | "brick"> =
  {
    LEAD: "neutral",
    QUALIFIED: "neutral",
    PROPOSAL: "neutral",
    NEGOTIATION: "neutral",
    WON: "ledger",
    LOST: "brick",
  };
