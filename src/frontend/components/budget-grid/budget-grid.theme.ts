import { themeQuartz } from "ag-grid-community";

/**
 * AG Grid v33+ Theming API: CSS dosyası import etmek yerine tema JS
 * nesnesiyle kurulur. Renkleri globals.css'teki tasarım jetonlarıyla
 * (--color-ledger, --color-rule, ...) eşleştiriyoruz ki tablo geri kalan
 * arayüzden kopuk durmasın.
 */
export const budgetGridTheme = themeQuartz.withParams({
  accentColor: "#0e7c6b", // --color-ledger
  backgroundColor: "#ffffff", // --color-surface
  foregroundColor: "#101a18", // --color-ink
  borderColor: "#d6dcd9", // --color-rule
  headerBackgroundColor: "#f2f4f3", // --color-paper
  headerTextColor: "#101a18",
  headerFontWeight: 600,
  oddRowBackgroundColor: "#fbfcfb",
  rowHoverColor: "#e3efec", // --color-ledger-soft
  selectedRowBackgroundColor: "#e3efec",
  wrapperBorderRadius: 8,
});
