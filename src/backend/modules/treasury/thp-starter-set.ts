import type { CashFlowDirection, MappingLayer } from "@/shared/types";

/**
 * THP (Tek Düzen Hesap Planı) varsayılan eşleştirme seti — 20 yaygın kod.
 * `POST /api/treasury/mappings/seed-defaults` ile tenant'ın kendi
 * `MappingConfig` tablosuna yazılır (config veri, kod içine gömülmez
 * felsefesiyle ÇELİŞMEZ — bkz. VukAmortismanConfig/SalesStageConfig'in
 * AKSİNE bu bir yasal zorunluluk DEĞİL, makul bir başlangıç noktası; tenant
 * dilediği gibi düzenler/siler).
 *
 * BİLİNÇLİ olarak hem CASH (bilanço, gerçek vade taşıyan) hem ACCRUAL
 * (gelir tablosu, nakit olayı ÜRETMEYEN) hesapları içerir — bu, THP
 * eşleştirmesinin en kritik güvenlik özelliğini (600/770 gibi P&L
 * hesaplarının double-count edilmemesi) varsayılan setle birlikte canlı
 * gösterir.
 */
export interface ThpStarterMapping {
  accountCode: string;
  accountName: string;
  /** Kategori KODU (id DEĞİL) — id tenant'a özeldir ve seed sırasında
   * çözümlenir (bkz. mapping-config.repository.ts#seedDefaults). */
  categoryCode: string;
  direction: CashFlowDirection;
  layer: MappingLayer;
  defaultTermDays?: number;
}

export const THP_STARTER_MAPPINGS: ThpStarterMapping[] = [
  // --- NAKİT KATMANI (bilanço — gerçek vade taşır) ---
  {
    accountCode: "120",
    accountName: "Alıcılar",
    categoryCode: "cat-gelir",
    direction: "INFLOW",
    layer: "CASH",
    defaultTermDays: 45,
  },
  {
    accountCode: "121",
    accountName: "Alacak Senetleri",
    categoryCode: "cat-gelir",
    direction: "INFLOW",
    layer: "CASH",
    defaultTermDays: 90,
  },
  {
    accountCode: "340",
    accountName: "Alınan Sipariş Avansları",
    categoryCode: "cat-gelir",
    direction: "INFLOW",
    layer: "CASH",
  },
  {
    accountCode: "320",
    accountName: "Satıcılar",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "CASH",
    defaultTermDays: 30,
  },
  {
    accountCode: "321",
    accountName: "Borç Senetleri",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "CASH",
    defaultTermDays: 90,
  },
  {
    accountCode: "335",
    accountName: "Personele Borçlar",
    categoryCode: "cat-personel",
    direction: "OUTFLOW",
    layer: "CASH",
    defaultTermDays: 5,
  },
  {
    accountCode: "360",
    accountName: "Ödenecek Vergi ve Fonlar",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "CASH",
    defaultTermDays: 26,
  },
  {
    accountCode: "361",
    accountName: "Ödenecek Sosyal Güvenlik Kesintileri",
    categoryCode: "cat-personel",
    direction: "OUTFLOW",
    layer: "CASH",
    defaultTermDays: 26,
  },
  {
    accountCode: "159",
    accountName: "Verilen Sipariş Avansları",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "CASH",
  },
  // --- TAHAKKUK KATMANI (gelir tablosu — nakit olayı ÜRETMEZ, sadece işaretlenir) ---
  {
    accountCode: "600",
    accountName: "Yurtiçi Satışlar",
    categoryCode: "cat-gelir",
    direction: "INFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "601",
    accountName: "Yurtdışı Satışlar",
    categoryCode: "cat-gelir",
    direction: "INFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "610",
    accountName: "Satıştan İadeler (-)",
    categoryCode: "cat-gelir",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "620",
    accountName: "Satılan Mamuller Maliyeti",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "621",
    accountName: "Satılan Ticari Mallar Maliyeti",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "630",
    accountName: "Araştırma ve Geliştirme Giderleri",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "631",
    accountName: "Pazarlama Satış ve Dağıtım Giderleri",
    categoryCode: "cat-pazarlama",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "632",
    accountName: "Genel Yönetim Giderleri",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "191",
    accountName: "İndirilecek KDV",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "391",
    accountName: "Hesaplanan KDV",
    categoryCode: "cat-diger",
    direction: "INFLOW",
    layer: "ACCRUAL",
  },
  {
    accountCode: "780",
    accountName: "Finansman Giderleri",
    categoryCode: "cat-diger",
    direction: "OUTFLOW",
    layer: "ACCRUAL",
  },
];
