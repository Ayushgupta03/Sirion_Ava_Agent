"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { analyze } from "@/lib/engine/rules";
import { personName } from "@/lib/engine/world";
import { timingFor } from "@/lib/engine/timing";
import { fmtDT, lakh } from "@/lib/format";
import { ApprovalsView, ChecklistView, DocumentsPanel, DraftBox, FactsTable, HandoffPacket, RoutingPanel, TimelineView } from "@/components/request";
import ConflictCard from "@/components/ConflictCard";
import { Card, CardHead, Chip, Empty, StateChip } from "@/components/ui";

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAva((s) => s.state);
  const req = state.requests[id];
  if (!req) return <Empty>Request {id} does not exist in this event log yet. <Link className="text-accent underline" href="/requests">All requests</Link></Empty>;
  const a = analyze(state, id);
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  const conflicts = Object.values(state.conflicts).filter((c) => c.requestId === id).sort((x, y) => (x.status === y.status ? y.openedAt.localeCompare(x.openedAt) : x.status === "open" ? -1 : 1));
  const drafts = state.drafts.filter((d) => d.requestId === id && !d.conflictId);
  const t = timingFor(state, id);
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12.5px] text-slate-500"><Link href="/requests" className="hover:underline">Requests</Link> › {sup ? <Link className="hover:underline" href={`/suppliers/${sup.id}`}>{sup.name}</Link> : `Possible new supplier: ${req.supplierGuess?.name}`} › {req.project}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="text-xl font-semibold">{req.id}: {req.title}</h1><StateChip state={a.handoff.state} /><Chip>{a.pipeline}</Chip>{req.startedBeforeApproval && <Chip tone="red">Started before approval</Chip>}</div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-600">
          <span>Owner: <b>{personName("karan")}</b> (Procurement)</span><span>Requester: {personName(req.requesterId)}</span><span>Cost centre: {req.costCentre}</span>
          <span>Value: <b>{lakh(a.requestAmount)}</b></span><span>90-day total: <b className={a.spend.overLimit ? "text-red-700" : ""}>{lakh(a.spend.total)}</b></span>
          <span>First email: {fmtDT(t.firstAt)}</span>{a.waitingOn && <span>Waiting on: <b>{a.waitingOn}</b></span>}
        </div>
      </div>
      {a.handoff.banner && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800">{a.handoff.banner}<ul className="mt-1 list-disc pl-5 text-[13px] font-normal">{a.handoff.reasons.filter((r) => /reconfirmation|conflict/i.test(r)).map((r) => <li key={r}>{r}</li>)}</ul></div>}
      {a.handoff.state === "in_progress" && <Card><CardHead title="Not ready for handoff yet" sub="Intake is complete when every required fact is confirmed, every checklist item is closed, every approval matches current facts, and the supplier is known." /><ul className="list-disc px-8 py-3 text-[13px] text-slate-700">{a.handoff.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Card>}
      {(a.handoff.state === "ready_legal" || a.handoff.state === "ready_po") && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-800">{a.handoff.state === "ready_legal" ? "Ready for Legal Review" : "Ready to issue PO"} since {fmtDT(req.readyAt!)}. Took {t.days} business day{t.days === 1 ? "" : "s"} against a 1-day target.{t.longest && ` Longest wait: ${t.longest}.`}</div>}
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <FactsTable a={a} />
          {conflicts.length > 0 && <section id="conflicts" className="space-y-3"><h2 className="text-[15px] font-semibold">Conflicts</h2>{conflicts.map((c) => <ConflictCard key={c.id} c={c} />)}</section>}
          <ApprovalsView a={a} />
          <DocumentsPanel a={a} state={state} />
          {(a.handoff.state === "ready_legal" || a.handoff.state === "ready_po") && <HandoffPacket a={a} state={state} />}
        </div>
        <div className="space-y-5">
          <RoutingPanel a={a} />
          <ChecklistView a={a} />
          {drafts.length > 0 && <Card><CardHead title="Drafts for the requester" sub="Ava never emails suppliers. The requester sends." /><div className="space-y-2 p-3">{drafts.map((d) => <DraftBox key={d.id} d={d} />)}</div></Card>}
          <TimelineView a={a} />
        </div>
      </div>
    </div>
  );
}
