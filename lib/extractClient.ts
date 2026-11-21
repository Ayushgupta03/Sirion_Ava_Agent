"use client";
// Runs extraction for a composed email: live AI through /api/ava, or the basic extractor if that fails.
import type { Email, Extraction, ExtractionSource, State } from "./types";
import { basicExtract } from "./basicExtractor";

export async function extractForEmail(email: Email, state: State): Promise<{ result: Extraction; source: ExtractionSource; note?: string }> {
  const openRequests = state.requestOrder.map((id) => state.requests[id]).filter((r) => !r.readyAt).map((r) => ({ id: r.id, title: r.title, supplier: r.supplierId, project: r.project, thread: Object.keys(state.threadRequest).find((t) => state.threadRequest[t] === r.id) }));
  try {
    const res = await fetch("/api/ava", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: { from: email.from, to: email.to, cc: email.cc, subject: email.subject, body: email.body, sentAt: email.sentAt, threadId: email.threadId },
        attachments: email.attachments.map((a) => ({ name: a.name, text: a.pages.map((p, i) => `--- page ${i + 1} ---\n${p.join("\n")}`).join("\n") })),
        context: { knownSuppliers: state.suppliers.map((s) => ({ name: s.name, domain: s.domain, known: s.known })), openRequests },
      }),
    });
    if (res.ok) { const d = await res.json(); return { result: d.result, source: "live" }; }
    const err = await res.json().catch(() => ({}));
    return { result: basicExtract(email, state.suppliers), source: "basic", note: err.error };
  } catch (e: any) {
    return { result: basicExtract(email, state.suppliers), source: "basic", note: e?.message };
  }
}

export async function uploadForText(file: File) {
  const fd = new FormData(); fd.append("file", file);
  const res = await fetch("/api/extract", { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
  return res.json() as Promise<{ kind: "pdf" | "xlsx" | "other"; pages: string[][]; sheets?: { name: string; rows: string[][] }[] }>;
}
