"use client";
import { useState } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { analyze } from "@/lib/engine/rules";
import { timingFor } from "@/lib/engine/timing";
import { personName } from "@/lib/engine/world";
import { fmtDT, fmtShort, hoursBetween, inr, lakh } from "@/lib/format";
import { Button, Card, CardHead, Chip, cx, Empty, PageTitle, SourceLink, Stat, StateChip } from "@/components/ui";
import { ConflictsTable } from "@/components/ConflictsTable";

const COLS = ["New", "Quote received", "Waiting on requester", "Due diligence", "Approvals", "Blocked by change", "Ready"];

export default function Dashboard() {
  const { state, act, viewAs, setViewAs } = useAva();
  const [tab, setTab] = useState<"pipeline" | "conflicts">("pipeline");
  const ids = state.requestOrder;
  const all = ids.map((id) => analyze(state, id));
  const sba = Object.entries(state.counters.startedBeforeApproval);
  const ready = ids.filter((id) => state.requests[id].readyAt);
  return (
    <div className="space-y-5">
      <PageTitle title="Dashboard" sub="Every supplier request captured from email, where it is, and who it is waiting on." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Forms filled" value={0} sub="Nobody filled in an intake form" tone="green" />
        <Stat label="Requests captured from email" value={ids.length} sub={`${state.emails.filter((e) => e.origin !== "ava_draft").length} emails recorded`} />
        <Stat label="Questions answered from documents" value={state.counters.answeredFromDocs} sub="instead of asking people" />
        <Stat label="Approvals reopened by changed facts" value={state.counters.approvalsReopened} tone={state.counters.approvalsReopened ? "red" : undefined} />
        <Stat label="Started before approval (recorded)" value={sba.reduce((n, [, v]) => n + v, 0)} sub={sba.length ? sba.map(([d, v]) => `${d}: ${v}`).join(", ") : "none recorded"} />
      </div>
      <div role="tablist" className="flex gap-1">
        {(["pipeline", "conflicts"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-md px-3 py-1.5 text-[13px]", tab === t ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100")}>{t === "pipeline" ? "Pipeline" : `Conflicts (${Object.values(state.conflicts).filter((c) => c.status === "open").length} open)`}</button>)}
      </div>
      {tab === "conflicts" ? <ConflictsTable /> : (
        <div className="overflow-x-auto"><div className="grid min-w-[1100px] grid-cols-7 gap-2">
          {COLS.map((col) => { const cards = all.filter((a) => a.pipeline === col); return (
            <div key={col} className="rounded-lg bg-slate-50 p-2">
              <div className="mb-2 flex items-center justify-between px-1 text-[12px] font-semibold text-slate-600"><span>{col}</span><span>{cards.length}</span></div>
              <div className="space-y-2">{cards.map((a) => { const sup = state.suppliers.find((s) => s.id === a.req.supplierId); return (
                <Link key={a.req.id} href={`/requests/${a.req.id}`} className={cx("block rounded-md border bg-white p-2.5 text-[12.5px] hover:border-accent", col === "Blocked by change" ? "border-red-300" : col === "Ready" ? "border-emerald-300" : "border-slate-200")}>
                  <div className="font-semibold text-slate-900">{sup?.name.replace(" Pvt Ltd", "") ?? a.req.supplierGuess?.name}</div>
                  <div className="text-slate-600">{a.req.project}</div>
                  <div className="mt-1 tabular">{lakh(a.requestAmount)} · 90d {lakh(a.spend.total)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{a.routing.approvals.some((x) => x.key === "vp") && <Chip tone="blue">VP</Chip>}{a.routing.needsInfosec && <Chip tone="blue">InfoSec</Chip>}{a.req.startedBeforeApproval && <Chip tone="red">Early start</Chip>}</div>
                  {a.waitingOn && <div className="mt-1 text-slate-600">Waiting on {a.waitingOn}</div>}
                  <div className="mt-1 text-slate-400">{a.req.id} · age {Math.round(hoursBetween(a.req.createdAt, a.req.readyAt ?? state.now))}h</div>
                </Link>); })}</div>
            </div>); })}
        </div></div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1"><CardHead title="Timing" sub="Cycle time from first email to Ready, against a 1-business-day target." />
          <div className="space-y-3 px-4 py-3 text-[13px]">
            {ids.length === 0 && <p className="text-slate-500">No requests yet.</p>}
            {ids.map((id) => { const t = timingFor(state, id); const r = state.requests[id]; return (
              <div key={id}><div className="font-medium"><Link className="text-accent hover:underline" href={`/requests/${id}`}>{id}</Link> {r.title}</div>
                {r.readyAt ? <p>First email {fmtShort(t.firstAt)}. Ready {fmtShort(r.readyAt)}. Took {t.days} business day{t.days === 1 ? "" : "s"} against a 1-day target{t.met ? " (met)" : ""}.{t.longest && ` Longest wait: ${t.longest}.`}</p>
                  : <p className="text-slate-600">First email {fmtShort(t.firstAt)}. Open for {t.days} business day{t.days === 1 ? "" : "s"}.{t.longest && ` Longest wait so far: ${t.longest}.`}</p>}</div>); })}
            {ready.length > 0 && <p className="text-[12px] text-slate-500">{ready.filter((id) => timingFor(state, id).met).length} of {ready.length} ready requests met the target.</p>}
          </div></Card>
        <Card><CardHead title="Changes feed" sub="Facts that changed, and the approvals they reopened." />
          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-auto text-[13px]">
            {state.changes.length === 0 && <li className="px-4 py-3 text-slate-500">No changes yet.</li>}
            {[...state.changes].reverse().map((c) => <li key={c.id} className="px-4 py-2"><div className="flex justify-between text-[12px] text-slate-500"><Link className="text-accent hover:underline" href={`/requests/${c.requestId}`}>{c.requestId}</Link><span>{fmtShort(c.at)}</span></div>
              <div><b>{c.field}</b>: {c.old} → <b>{c.new}</b> <SourceLink src={c.source} /></div>{c.reopened.length > 0 && <div className="text-red-700">Reopened: {c.reopened.join(", ")}</div>}</li>)}
          </ul></Card>
        <Card><CardHead title="Invoices with no request" sub="Spend that arrived without a request, contract or PO." />
          <div className="space-y-3 p-4 text-[13px]">
            {state.orphans.length === 0 && <Empty>None.</Empty>}
            {state.orphans.map((o) => { const sup = state.suppliers.find((s) => s.id === o.supplierId); return (
              <div key={o.id} className="rounded-md border border-amber-300 bg-amber-50/50 p-3">
                <div className="flex justify-between"><b>{o.invoiceNo}</b><span className="tabular">{inr(o.amount)} + GST</span></div>
                <div>{sup?.name}: {o.desc}</div><div className="text-[12px] text-slate-500">Received {fmtDT(o.createdAt)} · <SourceLink src={o.source} /></div>
                {o.status === "open" && o.likelyOwnerId && <div className="mt-2 rounded bg-white p-2 ring-1 ring-amber-200"><div className="text-[12px] text-slate-500">To {personName(o.likelyOwnerId)}:</div>“Looks like you're working with {sup?.name}. Confirm in 60 seconds and we'll cover you.”
                  <div className="mt-1.5 flex gap-1.5">{viewAs === o.likelyOwnerId ? <><Button small variant="primary" onClick={() => act({ type: "orphan_confirm", orphanId: o.id })}>Confirm</Button><Button small onClick={() => act({ type: "orphan_not_mine", orphanId: o.id })}>Not mine</Button></> : <button className="text-[12px] text-accent underline" onClick={() => setViewAs(o.likelyOwnerId!)}>View as {personName(o.likelyOwnerId)} to answer</button>}</div></div>}
                {o.status === "confirmed" && <div className="mt-1 text-emerald-800">Confirmed. Covered by <Link className="underline" href={`/requests/${o.requestId}`}>{o.requestId}</Link>.</div>}
                {o.status === "not_mine" && <div className="mt-1 text-amber-800">{personName(o.likelyOwnerId)} says not theirs. In Procurement's Unsorted tray.</div>}
              </div>); })}
          </div></Card>
      </div>
    </div>
  );
}
