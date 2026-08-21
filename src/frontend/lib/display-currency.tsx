"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

/**
 * GÖRÜNTÜLEME PARA BİRİMİ — uygulama genelinde tek seçim.
 *
 * Yalnızca SUNUM içindir: seçim, para birimi alan uçlara `displayCurrency`
 * sorgu parametresi olarak gider ve çevrimi SUNUCU yapar (bkz.
 * backend/modules/fx/display-currency.ts). Burada hiçbir kur aritmetiği YOK —
 * kur arama mantığının ikinci bir kopyası doğmasın diye.
 *
 * Seçim `localStorage`ta tutulur: sunucuya yazılacak bir tercih değil, tarayıcı
 * başına bir görüntüleme ayarıdır (aynı kullanıcı ofiste TRY, raporlamada USD
 * bakabilir).
 */

export const DISPLAY_CURRENCIES = ["TRY", "USD", "EUR"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** "Senaryonun kendi para birimi" — çevrim YAPILMAZ. Varsayılan budur:
 * kullanıcı açıkça istemedikçe kaydedilmiş rakamı olduğu gibi görür. */
export const NATIVE = "NATIVE" as const;
export type CurrencySelection = DisplayCurrency | typeof NATIVE;

const STORAGE_KEY = "fpa.displayCurrency";

interface CurrencyContextValue {
  selection: CurrencySelection;
  setSelection: (next: CurrencySelection) => void;
  /** Uçlara gönderilecek değer — NATIVE ise undefined (parametre eklenmez). */
  queryValue: string | undefined;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  selection: NATIVE,
  setSelection: () => {},
  queryValue: undefined,
});

/**
 * localStorage HARİCİ bir store'dur; `useSyncExternalStore` tam bu iş içindir.
 * Efekt içinde okuyup setState etmek (projenin `set-state-in-effect` kuralının
 * yasakladığı desen) hem lint hatası hem de bir kare boyunca yanlış para
 * biriminin görünmesi demekti. Sunucu anlık görüntüsü her zaman NATIVE'dir —
 * sunucuda localStorage yoktur, hydration uyuşmazlığı da böyle önlenir.
 */
function readSelection(): CurrencySelection {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === NATIVE ||
    (DISPLAY_CURRENCIES as readonly string[]).includes(stored ?? "")
    ? (stored as CurrencySelection)
    : NATIVE;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Başka bir sekmede değiştirilirse burası da güncellensin.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function DisplayCurrencyProvider({ children }: { children: React.ReactNode }) {
  const selection = useSyncExternalStore<CurrencySelection>(
    subscribe,
    readSelection,
    () => NATIVE,
  );

  const setSelection = useCallback((next: CurrencySelection) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    for (const listener of listeners) listener();
  }, []);

  return (
    <CurrencyContext.Provider
      value={{
        selection,
        setSelection,
        queryValue: selection === NATIVE ? undefined : selection,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useDisplayCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}

/** Sorgu dizesine `displayCurrency` ekler (NATIVE ise hiç eklemez). */
export function withDisplayCurrency(
  params: URLSearchParams,
  queryValue: string | undefined,
): URLSearchParams {
  if (queryValue) params.set("displayCurrency", queryValue);
  return params;
}
