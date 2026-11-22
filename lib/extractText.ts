// Server-side text extraction for PDF and XLSX. Used by the sample script and /api/extract.
import * as XLSX from "xlsx";
import type { Sheet } from "./types";
import { joinWrappedLines } from "./joinLines";

export interface ExtractedFile {
  kind: "pdf" | "xlsx" | "other";
  pages: string[][]; // lines per page
  sheets?: Sheet[];
}

export async function extractPdf(data: Uint8Array): Promise<string[][]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const pages: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x: item.transform[4], s: item.str });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join("  ").replace(/\s{3,}/g, "  ").trim());
    pages.push(joinWrappedLines(lines));
  }
  return pages;
}

export function extractXlsx(data: Uint8Array): { pages: string[][]; sheets: Sheet[] } {
  const wb = XLSX.read(data, { type: "array" });
  const sheets: Sheet[] = wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: false, blankrows: false }) as any[][];
    return { name, rows: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))) };
  });
  const pages = sheets.map((s) => [`Sheet: ${s.name}`, ...s.rows.map((r) => r.join(" | "))]);
  return { pages, sheets };
}

export async function extractFile(name: string, data: Uint8Array): Promise<ExtractedFile> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return { kind: "pdf", pages: await extractPdf(data) };
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    const { pages, sheets } = extractXlsx(data);
    return { kind: "xlsx", pages, sheets };
  }
  return { kind: "other", pages: [[new TextDecoder().decode(data).slice(0, 20000)]] };
}
