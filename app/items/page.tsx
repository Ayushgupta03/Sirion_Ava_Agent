"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { deriveItems, type Item } from "@/lib/engine/items";
import { analyze } from "@/lib/engine/rules";
import { PEOPLE, person, personName } from "@/lib/engine/world";
import { fmtShort, hoursBetween, lakh, span } from "@/lib/format";
import { DraftBox, ReceiptModal } from "@/components/request";
import { Button, Card, CardHead, Chip, cx, Empty, PageTitle, Quote, StateChip } from "@/components/ui";
import { roleOf } from "@/components/Shell";

const DEPTS = [["karan", "Procurement"], ["meera", "InfoSec"], ["suresh", "Finance"], ["farah", "Legal"], ["ananya", "Budget owner (Ananya)"], ["deepa", "Budget owner (Deepa)"], ["ritu", "Budget owner (Ritu)"], ["vikram", "VP"], ["rahul", "Requester (Rahul)"], ["neha", "Requester (Neha)"]];

const KIND: Record<string, string> = { reconfirm: "Needs reconfirmation", question: "Question", info: "For information", draft: "Draft to send", approval: "Approval", conflict: "Conflict", competing: "Quote or exception", retro: "Early start", legal: "Legal review", packet: "Handoff packet", supplier: "New supplier", orphan: "Invoice", unsorted: "Unsorted", finance: "Tax details", mention: "Mention" };

function due(openedAt: string) {
  const d = new Date(openedAt); let add = 1;
  while (add > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = new Date(d.getTime() + 330 * 60000).getUTCDay(); if (w !== 0 && w !== 6) add--; }
  return d.toISOString();
}

export default function ItemsPage() {
  const { state, viewAs, setViewAs } = useAva();
  const items = useMemo(() => deriveItems(state).filter((i) => i.personId === viewAs), [state, viewAs]);
  const p = person(viewAs);
  const myRequests = state.requestOrder.map((id) => state.requests[id]).filter((r) => r.requesterId === viewAs);
  return (
    <div>
      <PageTitle title={items.length ? `${items.length} thing${items.length === 1 ? "" : "s"} waiting on ${personName(viewAs).split(" ")[0]}` : `Nothing is waiting on ${personName(viewAs).split(" ")[0]}`} sub="Only what is waiting on you." />
      <div role="tablist" aria-label="Department" className="mb-4 flex flex-wrap gap-1">
        {DEPTS.map(([id, label]) => { const n = deriveItems(state).filter((i) => i.personId === id).length; return (
          <button key={id} role="tab" aria-selected={viewAs === id} onClick={() => setViewAs(id)} className={cx("rounded-md border px-2.5 py-1 text-[12.5px]", viewAs === id ? "border-accent bg-accent-50 font-semibold text-accent-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>{label}{n > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10.5px] font-bold text-white">{n}</span>}</button>); })}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.length === 0 && <Empty>Nothing is waiting on {personName(viewAs)} right now.</Empty>}
          {items.map((it) => <ItemCard key={it.key} it={it} />)}
        </div>
        <div className="space-y-4">
          {myRequests.length > 0 && <Card><CardHead title="My requests" sub="Status in plain words." />
            <ul className="divide-y divide-slate-100">{myRequests.map((r) => { const a = analyze(state, r.id); return (
              <li key={r.id} className="px-4 py-2.5 text-[13px]"><Link href={`/requests/${r.id}`} className="font-medium text-accent hover:underline">{r.id} {r.title}</Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2"><StateChip state={a.handoff.state} /><span className="text-slate-600">{a.handoff.state.startsWith("ready") ? "Done. Nothing more needed from you." : a.waitingOn ? `Waiting on ${a.waitingOn}` : a.pipeline}</span></div></li>); })}</ul></Card>}
          {viewAs === "karan" && <ProcurementSide />}
          {viewAs === "farah" && <LegalSide />}
        </div>
      </div>
    </div>
  );
}

function ProcurementSide() {
  const state = useAva((s) => s.state);
  const open = Object.values(state.conflicts).filter((c) => c.status === "open");
  return (
    <Card><CardHead title="Procurement owns every request" sub="Every request, conflict and exception, plus the Unsorted tray." />
      <ul className="space-y-1 px-4 py-3 text-[13px]">
        <li><Link className="text-accent hover:underline" href="/requests">{state.requestOrder.length} request{state.requestOrder.length === 1 ? "" : "s"}</Link></li>
        <li><Link className="text-accent hover:underline" href="/conflicts">{open.length} open conflicts</Link></li>
        <li>{Object.values(state.requests).reduce((n, r) => n + r.exceptions.length, 0)} exceptions recorded</li>
        <li>Unsorted: {state.orphans.filter((o) => o.status !== "confirmed").length} invoice(s) with no request, {Object.values(state.requests).filter((r) => !state.suppliers.find((s) => s.id === r.supplierId)?.known).length} possible new supplier(s)</li>
      </ul></Card>
  );
}

function LegalSide() {
  const state = useAva((s) => s.state);
  const ready = state.requestOrder.filter((id) => analyze(state, id).handoff.state === "ready_legal");
  const withdrawn = state.requestOrder.filter((id) => !ready.includes(id) && state.requests[id].withdrawals?.length);
  return (
    <Card><CardHead title="Handoff packets" sub="Requests that reached Ready for Legal Review. This is where intake hands over to the next stage." />
      <ul className="divide-y divide-slate-100">{withdrawn.map((id) => { const w = state.requests[id].withdrawals!.at(-1)!; return <li key={id + "w"} className="bg-amber-50/60 px-4 py-2.5 text-[13px]"><Link className="font-medium text-accent hover:underline" href={`/requests/${id}`}>{id} {state.requests[id].title}</Link><div className="text-amber-900">Withdrawn from Legal review on {fmtShort(w.at)}: {w.reason}</div></li>; })}{ready.length ? ready.map((id) => <li key={id} className="px-4 py-2.5 text-[13px]"><Link className="font-medium text-accent hover:underline" href={`/requests/${id}#packet`}>{id} {state.requests[id].title}</Link><div className="text-slate-500">Ready {fmtShort(state.requests[id].readyAt!)}</div></li>) : (withdrawn.length ? null : <li className="px-4 py-3 text-[13px] text-slate-500">No packets yet.</li>)}</ul></Card>
  );
}

function ItemCard({ it }: { it: Item }) {
  const { state, act, viewAs } = useAva();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(""); const [mode, setMode] = useState<null | "exception" | "quote" | "retro" | "reassign" | "ask">(null);
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          {it.kind === "question" && it.flagId && <><Button variant="primary" small onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "yes" })}>Yes</Button><Button small onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "no" })}>No</Button></>}
          {(it.kind === "info" || it.kind === "mention") && it.flagId && <Button small onClick={() => act({ type: "dismiss_flag", requestId: it.requestId!, flagId: it.flagId! })}>Noted</Button>}
          {ap && <><Button variant="primary" small onClick={() => setOpen(true)}>{it.kind === "reconfirm" ? "Review and reconfirm" : "Review and approve"}</Button></>}
          {it.kind === "conflict" && <Link href={`/requests/${it.requestId}#conflicts`} className="rounded-md border border-accent bg-accent px-2 py-1 text-[12px] font-medium text-white">Open conflict card</Link>}
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
