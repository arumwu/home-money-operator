import { unzipSync } from "fflate";

export type ParsedInvoiceItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
};

export type ParsedInvoice = {
  invoiceNumber: string;
  issuedAt: string;
  merchantName: string;
  sellerTaxId?: string;
  totalAmount: number;
  items: ParsedInvoiceItem[];
};

type InvoiceDocument = { filename: string; text: string };

function decodeBytes(bytes: Uint8Array) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const replacementCount = (utf8.match(/�/g) ?? []).length;
  if (replacementCount < Math.max(2, utf8.length * 0.002)) return utf8;
  try {
    return new TextDecoder("big5").decode(bytes);
  } catch {
    return utf8;
  }
}

function looksLikeZip(filename: string, bytes: Uint8Array) {
  return (
    filename.toLowerCase().endsWith(".zip") ||
    (bytes[0] === 0x50 && bytes[1] === 0x4b)
  );
}

export function extractInvoiceDocuments(
  filename: string,
  bytes: Uint8Array,
): InvoiceDocument[] {
  if (!looksLikeZip(filename, bytes)) {
    return [{ filename, text: decodeBytes(bytes) }];
  }

  const entries = unzipSync(bytes);
  return Object.entries(entries)
    .filter(([name]) => /\.(csv|txt)$/i.test(name))
    .map(([name, content]) => ({ filename: name, text: decodeBytes(content) }));
}

function detectDelimiter(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 6);
  const delimiters = [",", "|", "\t", ";"];
  return delimiters
    .map((delimiter) => ({
      delimiter,
      score: lines.reduce((total, line) => total + line.split(delimiter).length, 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter ?? ",";
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[\s_()（）／/.-]/g, "");
}

const headerNames = {
  invoiceNumber: ["發票號碼", "發票號", "發票字軌號碼", "invnum", "invoicenumber"],
  issuedAt: ["發票日期", "開立日期", "交易日期", "消費日期", "invdate", "date"],
  merchantName: ["商店名稱", "商家名稱", "賣方名稱", "營業人名稱", "sellername", "merchant"],
  sellerTaxId: ["賣方統編", "營業人統編", "統一編號", "sellertaxid", "sellerban"],
  totalAmount: ["總金額", "發票金額", "消費金額", "交易金額", "amount", "totalamount"],
  itemName: ["品名", "商品名稱", "明細名稱", "description", "itemname"],
  quantity: ["數量", "quantity", "qty"],
  unitPrice: ["單價", "unitprice", "price"],
  itemAmount: ["小計", "明細金額", "itemamount", "subtotal"],
} as const;

type HeaderKey = keyof typeof headerNames;

function findColumn(headers: string[], key: HeaderKey) {
  const options = headerNames[key].map(normalizedHeader);
  return headers.findIndex((header) => options.includes(normalizedHeader(header)));
}

function invoiceNumber(value: string) {
  const match = value.toUpperCase().replace(/[-\s]/g, "").match(/[A-Z]{2}\d{8}/);
  return match?.[0] ?? null;
}

function numberValue(value?: string) {
  if (!value) return null;
  const cleaned = value.replace(/[,$NT$元\s]/gi, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function invoiceDate(value: string) {
  const normalized = value.trim().replace(/[年月.]/g, "/").replace(/日/g, "");
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let match = normalized.match(/(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = normalized.match(/\b(\d{7,8})\b/);
    if (match) {
      const compact = match[1];
      year = Number(compact.slice(0, compact.length - 4));
      month = Number(compact.slice(-4, -2));
      day = Number(compact.slice(-2));
    }
  }
  if (!year || !month || !day) return null;
  if (year < 1911) year += 1911;
  if (year > 2100 || month > 12 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}T12:00:00+08:00`;
}

function makeItem(row: string[], columns: Record<HeaderKey, number>) {
  const name = columns.itemName >= 0 ? row[columns.itemName]?.trim() : "";
  if (!name) return null;
  const quantity = numberValue(row[columns.quantity]);
  const unitPrice = numberValue(row[columns.unitPrice]);
  const amount = numberValue(row[columns.itemAmount]);
  return {
    name,
    ...(quantity !== null ? { quantity } : {}),
    ...(unitPrice !== null ? { unitPrice: Math.round(unitPrice) } : {}),
    ...(amount !== null ? { amount: Math.round(amount) } : {}),
  } satisfies ParsedInvoiceItem;
}

function parseWithHeader(rows: string[][]) {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => headerNames.invoiceNumber.map(normalizedHeader).includes(normalizedHeader(cell))),
  );
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const columns = Object.fromEntries(
    (Object.keys(headerNames) as HeaderKey[]).map((key) => [
      key,
      findColumn(headers, key),
    ]),
  ) as Record<HeaderKey, number>;
  if (columns.invoiceNumber < 0 || columns.totalAmount < 0) return [];

  const grouped = new Map<string, ParsedInvoice>();
  for (const row of rows.slice(headerIndex + 1)) {
    const number = invoiceNumber(row[columns.invoiceNumber] ?? "");
    const issuedAt = invoiceDate(row[columns.issuedAt] ?? "");
    const total = numberValue(row[columns.totalAmount]);
    if (!number || !issuedAt || total === null) continue;
    const key = `${number}|${issuedAt.slice(0, 10)}|${Math.round(total)}`;
    const existing = grouped.get(key);
    const item = makeItem(row, columns);
    if (existing) {
      if (item && !existing.items.some((candidate) => candidate.name === item.name)) {
        existing.items.push(item);
      }
      continue;
    }
    grouped.set(key, {
      invoiceNumber: number,
      issuedAt,
      merchantName:
        (columns.merchantName >= 0 && row[columns.merchantName]?.trim()) ||
        "未識別商家",
      sellerTaxId:
        columns.sellerTaxId >= 0
          ? row[columns.sellerTaxId]?.match(/\d{8}/)?.[0]
          : undefined,
      totalAmount: Math.round(total),
      items: item ? [item] : [],
    });
  }
  return [...grouped.values()];
}

function likelyMerchant(cells: string[], numberIndex: number) {
  const candidates = cells
    .map((cell, index) => ({ cell: cell.trim(), index }))
    .filter(({ cell, index }) => {
      if (!cell || index === 0 || index === numberIndex) return false;
      if (invoiceNumber(cell) || invoiceDate(cell)) return false;
      if (/^\d+(?:\.\d+)?$/.test(cell.replace(/[,元$\s]/g, ""))) return false;
      return /[\p{L}\p{Script=Han}]/u.test(cell) && cell.length >= 2;
    })
    .sort((a, b) => b.cell.length - a.cell.length);
  return candidates[0]?.cell ?? "未識別商家";
}

function parseHeuristically(rows: string[][]) {
  const invoices: ParsedInvoice[] = [];
  let current: ParsedInvoice | null = null;
  for (const row of rows) {
    const numberIndex = row.findIndex((cell) => invoiceNumber(cell));
    if (numberIndex >= 0) {
      const number = invoiceNumber(row[numberIndex]);
      const issuedAt = row.map(invoiceDate).find(Boolean) ?? null;
      const numeric = row
        .map((cell, index) => ({ value: numberValue(cell), index }))
        .filter(
          (entry) =>
            entry.value !== null &&
            entry.index !== numberIndex &&
            Math.abs(entry.value) < 10_000_000,
        );
      const total = numeric.at(-1)?.value ?? null;
      if (!number || !issuedAt || total === null) continue;
      const taxId = row.find((cell) => /^\d{8}$/.test(cell.trim()));
      current = {
        invoiceNumber: number,
        issuedAt,
        merchantName: likelyMerchant(row, numberIndex),
        sellerTaxId: taxId?.trim(),
        totalAmount: Math.round(total),
        items: [],
      };
      invoices.push(current);
      continue;
    }

    if (current && /^D$/i.test(row[0]?.trim() ?? "")) {
      const name = likelyMerchant(row, -1);
      const values = row.map(numberValue).filter((value) => value !== null);
      if (name !== "未識別商家") {
        current.items.push({
          name,
          ...(values[0] !== undefined ? { quantity: values[0] } : {}),
          ...(values.at(-1) !== undefined
            ? { amount: Math.round(values.at(-1) as number) }
            : {}),
        });
      }
    }
  }
  return invoices;
}

export function parseEinvoiceText(text: string) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];
  const rows = parseDelimited(clean, detectDelimiter(clean));
  const withHeaders = parseWithHeader(rows);
  return withHeaders.length ? withHeaders : parseHeuristically(rows);
}
