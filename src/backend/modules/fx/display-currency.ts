import { fxRateService } from "./fx-rate.service";

/**
 * GÖRÜNTÜLEME PARA BİRİMİ — kullanıcı her ekranda para birimini değiştirebilir.
 *
 * Çevrim SUNUCUDA yapılır, frontend'de DEĞİL: kur arama mantığı (ters kur,
 * TRY pivot üzerinden çapraz kur, "o tarihte veya öncesinde en güncel")
 * `fxRateService`te TEK bir yerde durur. İstemciye kur dizisi gönderip orada
 * çarpmak, o mantığın ikinci (ve kaçınılmaz olarak ayrışan) bir kopyasını
 * doğururdu — konsolidasyon da aynı sebeple sunucuda çevirir.
 *
 * SAKLANAN VERİ DEĞİŞMEZ: tutarlar kaynak para biriminde (senaryonun/hesabın
 * kendi birimi) saklanır; bu sadece bir SUNUM katmanıdır.
 *
 * KUR YOKSA: hata FIRLATILMAZ (ekran tamamen boş kalmasın) — çevrim yapılmaz,
 * kaynak para biriminde gösterilir ve GÖRÜNÜR bir uyarı döner. Sessizce yanlış
 * bir sayı göstermek, uyarıyla birlikte doğru ama beklenenden farklı bir para
 * biriminde göstermekten çok daha tehlikelidir (bkz. treasury-fx.ts'teki aynı
 * disiplin).
 */

export interface DisplayConversion {
  /** Sonuçta kullanılan para birimi — kur bulunamadıysa KAYNAK birim. */
  currency: string;
  /** 1 = çevrim yok. */
  rate: number;
  warnings: string[];
  /** Tutarı görüntüleme para birimine çevirir. */
  convert: (amount: number) => number;
}

const IDENTITY = (amount: number) => amount;

export function noConversion(sourceCurrency: string): DisplayConversion {
  return { currency: sourceCurrency, rate: 1, warnings: [], convert: IDENTITY };
}

/**
 * `sourceCurrency` -> `displayCurrency` çevrim katsayısını çözer.
 * `displayCurrency` verilmemişse ya da kaynakla aynıysa çevrim yapılmaz.
 */
export async function resolveDisplayConversion(
  sourceCurrency: string,
  displayCurrency: string | undefined,
  asOfDate: string,
): Promise<DisplayConversion> {
  if (!displayCurrency || displayCurrency === sourceCurrency) {
    return noConversion(sourceCurrency);
  }

  try {
    // 1 birim çevirerek katsayıyı alırız; her tutarı ayrı ayrı `convert`
    // çağrısıyla çevirmek yüzlerce satırda gereksiz DB turu demek olurdu.
    const { rate } = await fxRateService.convert(
      1,
      sourceCurrency,
      displayCurrency,
      asOfDate,
    );
    return {
      currency: displayCurrency,
      rate,
      warnings: [],
      convert: (amount: number) => Math.round(amount * rate * 100) / 100,
    };
  } catch {
    return {
      currency: sourceCurrency,
      rate: 1,
      warnings: [
        `${sourceCurrency} → ${displayCurrency} kuru ${asOfDate} tarihinde (veya ` +
          `öncesinde) bulunamadı. Tutarlar ÇEVRİLMEDİ, ${sourceCurrency} olarak ` +
          `gösteriliyor.`,
      ],
      convert: IDENTITY,
    };
  }
}

/** Desteklenen görüntüleme para birimleri — seçici bunları listeler. */
export const DISPLAY_CURRENCIES = ["TRY", "USD", "EUR"] as const;
