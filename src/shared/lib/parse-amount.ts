/**
 * "420.000,00", "420000", "1,234.5" gibi hem TR hem EN biçimli girdileri
 * sayıya çevirir. Frontend'de (grid kopyala/yapıştır) VE backend'de (dosya
 * içe aktarma) kullanılan tek ortak sayı ayrıştırıcı — iki yerde farklı
 * kurallarla parse etmek, aynı "420,50" değerinin farklı yorumlanmasına
 * (420,5 vs 42050) yol açabilir.
 */
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/[^\d,.-]/g, "");
  if (s === "" || s === "-") return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Son geçen ayraç ondalık ayracıdır (1.234,56 -> 1234.56 / 1,234.56 -> 1234.56).
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
