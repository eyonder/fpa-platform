/**
 * ORTAK METİN NORMALİZASYONU (Türkçe'ye duyarlı).
 *
 * `modules/imports/import-mapping.ts`ten BURAYA TAŞINDI: `tabular-file.ts`
 * ile AYNI "rule of three" gerekçesi, ama AYRI bir dosya — katlama (folding)
 * dosya okumakla değil METİN KARŞILAŞTIRMASIYLA ilgilidir ve üçüncü tüketicisi
 * (`treasury/reconciliation.matcher.ts`, karşı taraf adı benzerlik puanı) hiç
 * dosya okumaz. Bugünkü tüketiciler:
 *   1. imports/import-mapping.ts     — Mizan başlık/hesap adı eşleştirmesi
 *   2. treasury/thp-mapping.ts       — THP başlık eşleştirmesi
 *   3. treasury/reconciliation.matcher.ts — banka açıklaması ↔ karşı taraf skoru
 */

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Türkçe'ye özgü harfleri ASCII karşılığına indirger (ş->s, ı->i, ğ->g, ü->u,
 * ö->o, ç->c). Eş anlamlı tablosunu (ve ay adlarını) TEK bir ASCII biçiminde
 * tutup hem onu hem gelen veriyi bu fonksiyondan geçirerek karşılaştırıyoruz
 * — "maaş" yazan ama sözlükte sadece "maas" olan bir kaydın SESSİZCE
 * eşleşmemesi gibi hataları yapısal olarak önler (bkz. commit sonrası
 * doğrulama testi: bu tam olarak başımıza gelmişti, aksanlı/aksansız her
 * varyantı elle listelemek yerine tek bir katlama fonksiyonuna geçildi).
 */
function foldTurkish(text: string): string {
  return text
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/** Küçült + noktalama temizle + Türkçe harfleri ASCII'ye indir. */
export function fold(text: string): string {
  return foldTurkish(normalize(text));
}

/** `fold` sonrası boşluğa göre parçalar; 2 harften kısa jetonlar atılır
 * ("a.ş.", "ltd" gibi gürültüyü değil, tek harflik artıkları eler). */
export function foldTokens(text: string): string[] {
  return fold(text)
    .split(" ")
    .filter((token) => token.length >= 2);
}
