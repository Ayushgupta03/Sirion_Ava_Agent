"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAva } from "@/lib/store";
import { displayAddr } from "@/lib/engine/world";
import { fmtDT } from "@/lib/format";
import { Button, cx } from "./ui";

const n = (s: string) => s.replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

/** Locate a quote across lines. Returns per-line [start,end] highlight ranges. */
export function locate(lines: string[], quote?: string): { ranges: Map<number, [number, number]>; exact: boolean } {
  const ranges = new Map<number, [number, number]>();
  if (!quote) return { ranges, exact: false };
  const norm = lines.map(n);
  const offs: number[] = []; let joined = "";
  norm.forEach((l, i) => { offs[i] = joined.length; joined += (i ? " " : "") + l; if (i) offs[i] += 1; });
  const q = n(quote).toLowerCase().replace(/^["“]|["”]$/g, "");
  const idx = joined.toLowerCase().indexOf(q);
  if (idx >= 0) {
    const end = idx + q.length;
    norm.forEach((l, i) => { const s = offs[i], e = s + l.length; if (e > idx && s < end) ranges.set(i, [Math.max(0, idx - s), Math.min(l.length, end - s)]); });
    return { ranges, exact: true };
  }
  // Closest line by shared words (used only when the quote is not verbatim).
  const words = new Set(q.split(/\W+/).filter((w) => w.length > 2));
  let best = -1, score = 0;
  norm.forEach((l, i) => { const sc = l.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length; if (sc > score) { score = sc; best = i; } });
  if (best >= 0 && score >= 2) ranges.set(best, [0, norm[best].length]);
  return { ranges, exact: false };
}

function Lines({ lines, quote, quotes, startNo = 1, added }: { lines: string[]; quote?: string; quotes?: string[]; startNo?: number; added?: Set<string> }) {
  const all = [...(quotes ?? []), ...(quote ? [quote] : [])];
  const { ranges, exact } = useMemo(() => {
    const merged = new Map<number, [number, number]>(); let ex = all.length > 0;
    for (const q of all) { const r = locate(lines, q); if (!r.exact) ex = false; r.ranges.forEach((v, k) => merged.set(k, v)); }
    return { ranges: merged, exact: ex };
  }, [lines, all.join("|")]);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "center" }); }, [all.join("|")]);
  let first = true;
  return (
    <>
      {all.length > 0 && !exact && ranges.size > 0 && <p className="mb-2 text-[12px] text-amber-700">Part of the quote is not verbatim in this file. Closest line highlighted.</p>}
      {all.length > 0 && ranges.size === 0 && <p className="mb-2 text-[12px] text-amber-700">Quote not found on this page.</p>}
      <ol className="space-y-0.5 font-mono text-[12.5px] leading-relaxed">
        {lines.map((l0, i) => {
          const l = n(l0); const r = ranges.get(i);
          const setRef = r && first ? ((el: HTMLElement | null) => { ref.current = el; }) : undefined; if (r) first = false;
          const isNew = added?.has(n(l0));
          return (
            <li key={i} className={cx("flex gap-3 rounded", isNew && "bg-amber-50")}><span className="w-6 shrink-0 select-none text-right text-slate-400">{startNo + i}</span>
              <span>{r ? <>{l.slice(0, r[0])}<mark ref={setRef} className="src">{l.slice(r[0], r[1])}</mark>{l.slice(r[1])}</> : l || "\u00a0"}</span>{isNew && <span className="ml-auto shrink-0 rounded bg-amber-200 px-1.5 text-[10.5px] font-sans font-semibold text-amber-900">New</span>}</li>
          );
        })}
      </ol>
    </>
  );
}

export default function SourceViewer() {
  const viewer = useAva((s) => s.viewer); const close = useAva((s) => s.closeViewer); const state = useAva((s) => s.state);
  const [tab, setTab] = useState<"text" | "original">("text");
  useEffect(() => { setTab("text"); }, [viewer]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [close]);
  if (!viewer) return null;
  const email = state.emails.find((e) => e.id === viewer.emailId);
  const att = email?.attachments.find((a) => a.id === viewer.attachmentId);
  const older = viewer.compareWith ? state.emails.flatMap((e) => e.attachments).find((a) => a.id === viewer.compareWith) : undefined;
  const added = older && att ? new Set(att.pages.flat().map(n).filter((l) => !new Set(older.pages.flat().map(n)).has(l))) : undefined;
  return (
    <div role="dialog" aria-modal="true" aria-label="Source" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={close}>
      <div className={cx("flex max-h-[88vh] w-full flex-col rounded-lg bg-white shadow-xl", older ? "max-w-5xl" : "max-w-3xl")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Source</div>
            <div className="text-[15px] font-semibold">{viewer.title ?? (att ? att.name : email ? email.subject : "Not found")}</div>
            {email && <div className="text-[12px] text-slate-500">{att ? "Attachment to" : "Email"} from {displayAddr(email.from, state)} to {email.to.map((t) => displayAddr(t, state)).join(", ")}, {fmtDT(email.sentAt)}</div>}
            {(viewer.quote || viewer.quotes?.length) && <div className="mt-1 text-[12.5px] text-slate-700">Highlighted: {[...(viewer.quotes ?? []), ...(viewer.quote ? [viewer.quote] : [])].map((q) => `“${q}”`).join(", ")}</div>}
          </div>
          <Button small variant="ghost" onClick={close}>Close</Button>
        </div>
        {att && (
          <div role="tablist" className="flex gap-1 border-b border-slate-100 px-5 pt-2">
            {(["text", "original"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-t-md px-3 py-1.5 text-[13px]", tab === t ? "border border-b-white border-slate-200 bg-white font-semibold" : "text-slate-600")}>{t === "text" ? "Text with source highlighted" : "Original file"}</button>)}
          </div>
        )}
        <div className="overflow-auto px-5 py-4">
          {!email && <p>Source email not found in the mailbox.</p>}
          {email && !att && <Lines lines={email.body.split(/\n|(?<=[.!?])\s+/)} quote={viewer.quote} />}
          {att && older && tab === "text" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div><div className="mb-1 text-[12px] font-semibold text-slate-500">Before: {older.name}</div><Lines lines={older.pages[0]} /></div>
              <div><div className="mb-1 text-[12px] font-semibold text-slate-900">Now: {att.name}</div><Lines lines={att.pages[0]} quote={viewer.quote} quotes={viewer.quotes} added={added} /></div>
            </div>
          )}
          {att && !older && tab === "text" && att.pages.map((p, i) => (
            <div key={i} className="mb-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{att.kind === "xlsx" ? p[0] : `Page ${i + 1}`}</div>
              <Lines lines={att.kind === "xlsx" ? p.slice(1) : p} quote={viewer.quote} quotes={viewer.quotes} />
            </div>
          ))}
          {att && tab === "original" && (att.url ? (att.kind === "pdf" ? <iframe title={att.name} src={att.url} className="h-[65vh] w-full rounded border" /> : (
            <div className="space-y-4">
              {(att.sheets ?? []).map((s) => (
                <div key={s.name}><div className="mb-1 text-[12px] font-semibold">{s.name}</div>
                  <table className="w-full border text-[12.5px]"><tbody>{s.rows.map((r, i) => <tr key={i} className={i === 0 ? "bg-slate-50 font-semibold" : ""}>{r.map((c, j) => <td key={j} className="border px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
                </div>
              ))}
              <a className="text-accent underline" href={att.url} download>Download {att.name}</a>
            </div>
          )) : <p className="text-slate-500">The original file is not stored in this browser. Extracted text is shown on the first tab.</p>)}
          {att?.url && tab === "original" && att.kind === "pdf" && <a className="mt-2 inline-block text-[12.5px] text-accent underline" href={att.url} target="_blank" rel="noreferrer">Open {att.name} in a new tab</a>}
        </div>
      </div>
    </div>
  );
}
