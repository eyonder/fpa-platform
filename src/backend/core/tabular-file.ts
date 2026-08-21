import ExcelJS from "exceljs";

import { AppError } from "./errors";

/**
 * ORTAK TABLO DOSYASI AYRIŞTIRICISI (CSV / XLSX).
 *
 * `modules/imports/import-parser.ts`ten BURAYA TAŞINDI: artık ÜÇ ayrı içe
 * aktarım akışı aynı ayrıştırıcıyı kullanıyor (Mizan/Muavin bütçe içe
 * aktarımı, THP nakit içe aktarımı, banka ekstresi içe aktarımı) — "rule of
 * three". Tek bir modülün altında kalsaydı diğer iki modül `imports/`e
 * bağımlı olurdu; oysa aralarında İŞ MANTIĞI ortaklığı YOK, sadece dosya
 * okuma ortaklığı var.
 *
 * Bu dosya iş mantığı BİLMEZ — hangi kolonun ne anlama geldiği çağıran
 * modülün (`import-mapping.ts` / `thp-mapping.ts` / `bank-statement-mapping.ts`)
 * sorunudur.
 */

/** Bir dosyanın ham hali: başlık satırı + veri satırları (hepsi metin). */
export interface ParsedFile {
  headers: string[];
  rows: string[][];
}

/**
 * RFC4180'e yakın, elle yazılmış bir CSV ayrıştırıcı — tırnaklı alan, alan
 * içinde kaçışlı çift tırnak (""), alan içinde satır sonu destekler.
 *
 * Ayraç OTOMATİK belirlenir: Türkçe Excel'de ondalık ayracı "," olduğu için
 * CSV dışa aktarımı genelde ";" kullanır — sadece "," varsaymak Mizan/Muavin
 * dosyalarının çoğunu bozardı.
 */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delimiter = semicolons > commas ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow(); // son satır \n ile bitmiyorsa

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text; // hyperlink hücresi
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((r) => r.text ?? "")
        .join("");
    }
    if ("result" in obj) return cellToString(obj.result as ExcelJS.CellValue); // formül hücresi
    return "";
  }

  return String(value);
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError(
      "IMPORT_EMPTY_FILE",
      "Dosyada okunabilir bir sayfa bulunamadı.",
      422,
    );
  }

  const rows: string[][] = [];
  worksheet.eachRow((row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-index'li; values[0] boş.
    const cells: string[] = [];
    for (let c = 1; c < values.length; c++) cells[c - 1] = cellToString(values[c]);
    rows.push(cells);
  });

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Uzantıya göre CSV ya da XLSX/XLS olarak ayrıştırır, başlık + veri satırlarına ayırır. */
export async function parseFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const grid = isCsv ? parseCsv(buffer.toString("utf-8")) : await parseXlsx(buffer);

  if (grid.length === 0) {
    throw new AppError("IMPORT_EMPTY_FILE", "Dosya boş ya da okunamadı.", 422);
  }

  const [headerRow, ...dataRows] = grid;
  const headers = headerRow.map((h) => h.trim());
  const rows = dataRows.map((row) => headers.map((_, i) => (row[i] ?? "").trim()));

  return { headers, rows };
}
