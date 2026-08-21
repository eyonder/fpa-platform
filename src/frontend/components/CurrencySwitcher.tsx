"use client";

import {
  DISPLAY_CURRENCIES,
  NATIVE,
  useDisplayCurrency,
} from "@/frontend/lib/display-currency";
import type { CurrencySelection } from "@/frontend/lib/display-currency";

const LABEL: Record<string, string> = {
  [NATIVE]: "Kayıtlı birim",
  TRY: "₺ TRY",
  USD: "$ USD",
  EUR: "€ EUR",
};

/**
 * Üst çubuktaki para birimi seçici — her sayfada geçerlidir.
 *
 * "Kayıtlı birim" (varsayılan) çevrim YAPMAZ: senaryo/hesap hangi para
 * biriminde kaydedildiyse o gösterilir. Diğer seçenekler sunucuya
 * `displayCurrency` olarak gider; çevrim orada, `FxRate` üzerinden yapılır
 * (bkz. backend/modules/fx/display-currency.ts). Kur yoksa ekran boş kalmaz,
 * kaynak para biriminde gösterilir ve sayfada GÖRÜNÜR bir uyarı çıkar.
 */
export function CurrencySwitcher() {
  const { selection, setSelection } = useDisplayCurrency();

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Görüntüleme para birimi</span>
      <select
        value={selection}
        onChange={(e) => setSelection(e.target.value as CurrencySelection)}
        title="Görüntüleme para birimi — kayıtlı veriyi değiştirmez"
        className="rounded-md border border-rule bg-surface px-2 py-1 text-xs text-ink focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
      >
        <option value={NATIVE}>{LABEL[NATIVE]}</option>
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {LABEL[c]}
          </option>
        ))}
      </select>
    </label>
  );
}
