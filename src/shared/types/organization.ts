/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Holding / çok şubeli yapı: her Organization kendi tenant'ıdır (kendi
 * Scenario'ları, kendi para birimi), parentOrganizationId ile üst şirkete
 * bağlanır. Konsolidasyon modülü bu ağacı yukarı doğru toplar.
 */
export interface Organization {
  id: string;
  name: string;
  /** null ise en tepedeki (holding) şirkettir. */
  parentOrganizationId: string | null;
  /** Bu şirketin kendi defterlerini tuttuğu para birimi. */
  baseCurrency: string;
}
