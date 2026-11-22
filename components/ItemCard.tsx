"use client";
// One decision card: what is waiting on a person, with Ava's recommendation.
import { useState } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import type { Item } from "@/lib/engine/items";
import { analyze } from "@/lib/engine/rules";
import { PEOPLE } from "@/lib/engine/world";
import { fmtShort, hoursBetween, span } from "@/lib/format";
import { DraftBox, ReceiptModal } from "./request";
import { Button, Card, Chip, cx, Quote } from "./ui";
import { AvaRecommends } from "./ai";
import { conflictAnchor } from "./ConflictCard";
import type { State } from "@/lib/types";

export const KIND: Record<string, string> = { reconfirm: "Needs reconfirmation", question: "Question", info: "For information", draft: "Draft to send", approval: "Approval", conflict: "Conflict", competing: "Quote or exception", retro: "Early start", legal: "Legal review", packet: "Handoff packet", supplier: "New supplier", orphan: "Invoice", unsorted: "Unsorted", finance: "Tax details", mention: "Mention" };

function due(openedAt: string) {
  const d = new Date(openedAt); let add = 1;
  while (add > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = new Date(d.getTime() + 330 * 60000).getUTCDay(); if (w !== 0 && w !== 6) add--; }
  return d.toISOString();
}

/** Which recommendation belongs to an item. */
export function recKeyFor(state: State, it: Item): string | undefined {
  if (it.conflictId) return it.conflictId;
  if (it.approvalKey && it.requestId) { const k = `receipt:${it.requestId}:${it.approvalKey}`; if (state.ai.recs[k]) return k; }
  const conf = (part: string) => Object.values(state.conflicts).find((c) => c.requestId === it.requestId && c.id.includes(part))?.id;
  if (it.flagId?.endsWith(":data_access")) return conf(":hidden_scope:");
  if (it.flagId?.endsWith(":keep_line")) return conf(":said_vs_written:amount");
  return undefined;
}

export function ItemCard({ it, compact }: { it: Item; compact?: boolean }) {
  const { state, act, viewAs } = useAva();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(""); const [note, setNote] = useState("");
  const rk = recKeyFor(state, it); const [mode, setMode] = useState<null | "exception" | "quote" | "retro" | "reassign" | "ask">(null);
  const rec = state.items[it.key];
  const a = it.requestId ? analyze(state, it.requestId) : undefined;
  const ap = a && it.approvalKey ? a.approvals.find((x) => x.key === it.approvalKey) : undefined;
  const draft = it.draftId ? state.drafts.find((d) => d.id === it.draftId) : undefined;
  const tone = it.kind === "reconfirm" || it.kind === "conflict" ? "red" : it.kind === "approval" || it.kind === "question" ? "amber" : "grey";
  const age = rec ? Math.max(0, Math.round(hoursBetween(rec.openedAt, state.now))) : 0;
  return (
    <Card className={cx(tone === "red" && "border-red-300")}>
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
          <span>{it.requestId ? <Link className="font-medium text-accent hover:underline" href={`/requests/${it.requestId}`}>{it.requestId} · {it.title}</Link> : it.title}</span>
          <span className="flex items-center gap-2">{rec && <>Opened {fmtShort(rec.openedAt)} · waiting {span(hoursBetween(rec.openedAt, state.now))} · due {fmtShort(due(rec.openedAt))}</>}<Chip tone={tone as any}>{KIND[it.kind] ?? it.kind}</Chip></span>
        </div>
        <p className="mt-1.5 text-[14.5px] font-medium text-slate-900">{it.question}</p>
        {it.detail && <p className="text-[12.5px] text-slate-600">{it.detail}</p>}
        {it.evidence && <div className="mt-2"><Quote src={it.evidence} /></div>}
        {draft && <div className="mt-2"><DraftBox d={draft} /></div>}
        {rk && it.requestId && (compact && it.kind === "conflict"
          ? <a href={`#${conflictAnchor(it.conflictId!)}`} className="mt-2 inline-block py-1 text-[13px] font-medium text-accent hover:underline">See Ava’s recommendation and the actions on the conflict card →</a>
          : <div className="mt-2"><AvaRecommends recKey={rk} requestId={it.requestId} readOnly={compact || it.kind !== "conflict"} /></div>)}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {it.kind === "question" && it.flagId && !it.flagId.endsWith(":keep_line") && <><Button variant="primary" small onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "yes" })}>Yes</Button><Button small onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "no" })}>No</Button></>}
          {it.kind === "question" && it.flagId?.endsWith(":keep_line") && <><input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional)" className="rounded border border-slate-300 px-2 py-1 text-[12.5px]" /><Button variant="primary" small onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "yes", note })}>Keep it</Button><Button small onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "no", note })}>Remove it</Button></>}
          {(it.kind === "info" || it.kind === "mention") && it.flagId && <Button small onClick={() => act({ type: "dismiss_flag", requestId: it.requestId!, flagId: it.flagId! })}>Noted</Button>}
          {ap && <><Button variant="primary" small onClick={() => setOpen(true)}>{it.kind === "reconfirm" ? "Review and reconfirm" : "Review and approve"}</Button></>}
          {it.kind === "conflict" && !compact && <Link href={`/requests/${it.requestId}#conflicts`} className="rounded-md border border-accent bg-accent px-2 py-1 text-[12px] font-medium text-white">Open conflict card</Link>}
          {it.kind === "competing" && <><Button small variant="primary" onClick={() => { setMode("exception"); setText("Sole supplier: Trivenika already runs our Salesforce support (SOW-0412)."); }}>Record exception</Button><Button small onClick={() => { setMode("quote"); setText(""); }}>Attach competing quote</Button></>}
          {it.kind === "retro" && <Button small variant="primary" onClick={() => { setMode("retro"); setText(""); }}>Record reason</Button>}
          {it.kind === "supplier" && <Button small variant="primary" onClick={() => act({ type: "add_supplier", requestId: it.requestId! })}>Add to supplier list</Button>}
          {it.kind === "orphan" && <><Button small variant="primary" onClick={() => act({ type: "orphan_confirm", orphanId: it.orphanId! })}>Confirm</Button><Button small onClick={() => act({ type: "orphan_not_mine", orphanId: it.orphanId! })}>Not mine</Button></>}
          {(it.kind === "packet" || it.kind === "legal" || it.kind === "finance" || it.kind === "unsorted") && it.requestId && <Link href={`/requests/${it.requestId}${it.kind === "packet" ? "#packet" : ""}`} className="rounded-md border border-slate-300 px-2 py-1 text-[12px] font-medium">{it.kind === "packet" ? "Open handoff packet" : "Open request"}</Link>}
          {it.requestId && <Button small variant="ghost" onClick={() => { setMode("ask"); setText(""); }}>Ask a question</Button>}
          <Button small variant="ghost" onClick={() => setMode("reassign")}>Reassign</Button>
        </div>
        {mode && mode !== "reassign" && <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return;
          if (mode === "exception") act({ type: "record_exception", requestId: it.requestId!, kind: "sole_supplier", reason: text });
          if (mode === "quote") act({ type: "competing_quote", requestId: it.requestId!, note: text });
          if (mode === "retro") act({ type: "record_exception", requestId: it.requestId!, kind: "retro", reason: text });
          if (mode === "ask") act({ type: "comment", requestId: it.requestId!, text });
          setMode(null); }}>
          <input aria-label="Text" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "ask" ? "Ask with @mention, e.g. @Rahul is the start date firm?" : mode === "quote" ? "Supplier and amount of the competing quote" : "Reason"} className="flex-1 rounded border border-slate-300 px-2 py-1 text-[13px]" />
          <Button small variant="primary" type="submit">Save</Button><Button small variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </form>}
        {mode === "reassign" && <div className="mt-2 flex items-center gap-2 text-[13px]">Reassign to <select aria-label="Reassign to" defaultValue="" onChange={(e) => { if (e.target.value) { act({ type: "reassign", itemKey: it.key, to: e.target.value }); setMode(null); } }} className="rounded border border-slate-300 px-2 py-1"><option value="">Choose…</option>{PEOPLE.filter((p) => p.id !== viewAs).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
      </div>
      {open && a && ap && <ReceiptModal a={a} ap={ap} onClose={() => setOpen(false)} />}
    </Card>
  );
}
