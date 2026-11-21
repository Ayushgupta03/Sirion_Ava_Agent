"use client";
import { useState } from "react";
import Link from "next/link";
import type { Conflict } from "@/lib/types";
import { useAva } from "@/lib/store";
import { firstName, PEOPLE, personName, POLICY } from "@/lib/engine/world";
import { extractForEmail } from "@/lib/extractClient";
import { labelSource } from "@/lib/engine/pipeline";
import { fmtDT, fmtShort, hoursBetween } from "@/lib/format";
import { Button, Chip, cx, Quote, StateChip } from "./ui";
import { DraftBox } from "./request";

export const CONFLICT_TYPE: Record<string, string> = { said_vs_written: "Said vs written", started_before_approval: "Started before approval", renewal_terms_changed: "Renewal terms changed", hidden_scope: "Hidden scope or data access" };

export default function ConflictCard({ c, showRequest }: { c: Conflict; showRequest?: boolean }) {
  const { act, viewAs, state, setViewAs } = useAva();
  const [mode, setMode] = useState<null | "value" | "comment">(null);
  const [val, setVal] = useState(""); const [reason, setReason] = useState(""); const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const req = state.requests[c.requestId];
  const canResolve = viewAs === c.ownerId || viewAs === POLICY.procurementOwner;
  const drafts = state.drafts.filter((d) => d.conflictId === c.id);
  const rerun = async () => {
    setBusy("Re-running Ava…");
    const last = [...req.emailIds].reverse().map((id) => state.emails.find((e) => e.id === id)).find((e) => e && e.origin !== "ava_draft" && e.attachments.length);
    if (last) { const r = await extractForEmail(last, state); act({ type: "rerun", requestId: req.id, emailId: last.id, extraction: r.result, source: r.source }); setBusy(`Re-ran on ${last.attachments.map((a) => a.name).join(", ")} (${labelSource(r.source)}).`); }
    else { act({ type: "rerun", requestId: req.id }); setBusy("Re-ran Ava on this request."); }
  };
  return (
    <article className={cx("rounded-lg border bg-white", c.status === "open" ? (c.severity === "blocking" ? "border-red-300" : "border-amber-300") : "border-slate-200")} aria-label={`Conflict: ${c.title}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5"><Chip tone="blue">{CONFLICT_TYPE[c.type]}</Chip><StateChip state={c.severity} /><StateChip state={c.status} />{c.escalated && <Chip tone="red">Escalated to {firstName(POLICY.vpApprover)}</Chip>}
            {showRequest && <Link className="text-[12.5px] font-medium text-accent hover:underline" href={`/requests/${c.requestId}`}>{c.requestId} · {req?.title}</Link>}</div>
          <h3 className="text-[14.5px] font-semibold">{c.title}</h3>
        </div>
        <div className="text-right text-[12px] text-slate-500">Opened {fmtDT(c.openedAt)}<br />{c.status === "open" ? `Age ${Math.round(hoursBetween(c.openedAt, state.now))}h` : `Closed ${fmtDT(c.resolvedAt!)}`}</div>
      </header>
      <div className="space-y-3 px-4 py-3 text-[13px]">
        <div><div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">1. What conflicts</div>
          <div className="grid gap-3 md:grid-cols-2">
            {[["A", c.a], ["B", c.b]].map(([k, side]: any) => (
              <div key={k}><div className="mb-1 text-[12.5px] font-semibold">Source {k}: {side.label}</div><div className="space-y-1.5">{side.quotes.map((q: any, i: number) => <Quote key={i} src={q} />)}</div></div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div><div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">2. Why it matters</div><p>{c.whyItMatters}</p></div>
          <div><div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">3. Who resolves it</div><p>{personName(c.ownerId)}{c.type === "renewal_terms_changed" && `, with ${personName(req.requesterId)}`}</p></div>
          <div><div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">4. What is blocked</div><p>{c.severity === "blocking" ? c.blocks : "Nothing (warning)"}</p></div>
        </div>
        {c.waitingOnSupplier && c.status === "open" && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Waiting on supplier since {fmtShort(c.waitingOnSupplier)}. Ava will re-check the reply.</p>}
        {c.status === "open" && (
          <div><div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">5. Actions</div>
            {!canResolve && <p className="mb-2 text-[12.5px] text-slate-500">{personName(c.ownerId)} resolves this. <button className="text-accent underline" onClick={() => setViewAs(c.ownerId)}>View as {firstName(c.ownerId)}</button></p>}
            <div className="flex flex-wrap gap-1.5">
              <Button small disabled={!canResolve} onClick={() => act({ type: "resolve_conflict", conflictId: c.id, choice: "A" })}>Accept source A{c.aValue ? `: ${c.aValue}` : ""}</Button>
              <Button small disabled={!canResolve} onClick={() => act({ type: "resolve_conflict", conflictId: c.id, choice: "B" })}>Accept source B{c.bValue ? `: ${c.bValue}` : ""}</Button>
              <Button small disabled={!canResolve} onClick={() => setMode(mode === "value" ? null : "value")}>Enter the correct value</Button>
              <Button small onClick={() => act({ type: "ask_supplier", requestId: c.requestId, conflictId: c.id }, viewAs)}>Ask the supplier</Button>
              <Button small onClick={() => setMode(mode === "comment" ? null : "comment")}>Comment</Button>
              <Button small onClick={rerun}>Re-run Ava</Button>
              <Button small variant="danger" disabled={c.escalated} onClick={() => act({ type: "escalate", conflictId: c.id })}>Escalate</Button>
            </div>
            {busy && <p className="mt-1.5 text-[12px] text-slate-500">{busy}</p>}
            {mode === "value" && <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (!val || !reason) return; act({ type: "resolve_conflict", conflictId: c.id, choice: "value", value: val, reason }); setMode(null); }}>
              <label className="text-[12px]">Value<input value={val} onChange={(e) => setVal(e.target.value)} placeholder="₹21,50,000" className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-[13px]" /></label>
              <label className="flex-1 text-[12px]">Reason (required)<input required value={reason} onChange={(e) => setReason(e.target.value)} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1 text-[13px]" /></label>
              <Button small variant="primary" type="submit" disabled={!val || !reason}>Save</Button>
            </form>}
          </div>
        )}
        {drafts.map((d) => <DraftBox key={d.id} d={d} />)}
        {(mode === "comment" || c.comments.length > 0) && (
          <div className="rounded-md bg-slate-50 p-3">
            <div className="mb-1 text-[12px] font-semibold">Comments</div>
            <ul className="space-y-1">{c.comments.map((cm) => <li key={cm.id}><b>{personName(cm.by)}</b> <span className="text-[12px] text-slate-500">{fmtShort(cm.at)}</span>: {cm.text}</li>)}</ul>
            {mode === "comment" && <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!comment.trim()) return; act({ type: "comment", requestId: c.requestId, conflictId: c.id, text: comment }); setComment(""); }}>
              <input aria-label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={`Use @ to mention, e.g. @${firstName(req.requesterId)} or @Farah`} className="flex-1 rounded border border-slate-300 px-2 py-1 text-[13px]" list="people-mentions" />
              <datalist id="people-mentions">{PEOPLE.map((p) => <option key={p.id} value={`@${p.name.split(" ")[0]} `} />)}</datalist>
              <Button small variant="primary" type="submit">Post</Button>
            </form>}
          </div>
        )}
        {c.status === "resolved" && c.resolution && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900"><div className="text-[12px] font-semibold uppercase tracking-wide">6. After resolution</div>
            {c.resolution.by === "ava" ? "Closed by Ava: " : `${personName(c.resolution.by)}: `}{c.resolution.text}{c.resolution.reopened.length > 0 && ` Approvals reopened: ${c.resolution.reopened.join(", ")}.`} <span className="text-[12px]">({fmtDT(c.resolvedAt!)})</span></div>
        )}
      </div>
    </article>
  );
}
