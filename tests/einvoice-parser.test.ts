import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractInvoiceDocuments, parseEinvoiceText } from "../lib/einvoice-parser.ts";

test("parses a header-based Taiwan e-invoice CSV", () => {
  const csv = [
    "發票號碼,發票日期,商店名稱,賣方統編,總金額,品名,數量,單價,小計",
    "AB12345678,115/07/16,生活超市,12345678,358,鮮奶,1,98,98",
    "AB12345678,115/07/16,生活超市,12345678,358,水果,2,130,260",
  ].join("\n");
  const result = parseEinvoiceText(csv);
  assert.equal(result.length, 1);
  assert.equal(result[0].invoiceNumber, "AB12345678");
  assert.equal(result[0].issuedAt.slice(0, 10), "2026-07-16");
  assert.equal(result[0].merchantName, "生活超市");
  assert.equal(result[0].totalAmount, 358);
  assert.deepEqual(result[0].items.map((item) => item.name), ["鮮奶", "水果"]);
});

test("extracts CSV documents from ZIP attachments", () => {
  const archive = zipSync({
    "消費資訊.csv": strToU8("發票號碼,發票日期,商店名稱,總金額\nCD87654321,2026/07/15,台灣電力公司,1260"),
    "readme.md": strToU8("ignored"),
  });
  const documents = extractInvoiceDocuments("einvoice.zip", archive);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].filename, "消費資訊.csv");
  assert.equal(parseEinvoiceText(documents[0].text)[0].totalAmount, 1260);
});
