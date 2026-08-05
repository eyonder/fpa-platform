import type { ImportBatch } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 *
 * `rawGrids`, batch'in henüz eşleştirilmemiş HAM satırlarını tutar — kullanıcı
 * kolon eşleştirmesini değiştirdiğinde (remap), dosyayı yeniden yüklemeden
 * bu ham veriyi yeni eşleştirmeyle tekrar çözümleyebilmek için ayrı tutulur.
 * commit sonrası artık gerekmediğinden silinir.
 */

interface RawGrid {
  headers: string[];
  rows: string[][];
}

const batches = new Map<string, ImportBatch>();
const rawGrids = new Map<string, RawGrid>();

export const importRepository = {
  async save(batch: ImportBatch): Promise<void> {
    batches.set(batch.id, batch);
  },

  async findById(id: string): Promise<ImportBatch | null> {
    return batches.get(id) ?? null;
  },

  async saveRawGrid(id: string, grid: RawGrid): Promise<void> {
    rawGrids.set(id, grid);
  },

  async findRawGrid(id: string): Promise<RawGrid | null> {
    return rawGrids.get(id) ?? null;
  },

  async deleteRawGrid(id: string): Promise<void> {
    rawGrids.delete(id);
  },
};
