"use client";
import { useState } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { analyze, type Analysis } from "@/lib/engine/rules";
import { timingFor, waitSplit } from "@/lib/engine/timing";
import { personName } from "@/lib/engine/world";
import { BACKGROUND } from "@/lib/background";
import { scenarioTag, timeLine } from "@/lib/summary";
import { fmtDT, hoursBetween, lakh, opened, parseAmount, span } from "@/lib/format";
import { Button, Card, CardHead, Chip, cx, Empty, PageTitle, SourceLink, Stat, StateChip, supplierShort } from "@/components/ui";
import { ConflictsTable } from "@/components/ConflictsTable";
import { AdviceCard, PredictionCard } from "@/components/insights";
import Board from "@/components/Board";
import { atRisk, catches, counters, northStar } from "@/lib/insights";
import { BG_CONFLICTS } from "@/lib/background";


export default function Dashboard() {
  const { state, act, viewAs, setViewAs } = useAva();
  const [tab, setTab] = useState<"pipeline" | "conflicts">("pipeline");
  const ids = state.requestOrder;
  const all = ids.map((id) => analyze(state, id));
  const sba = Object.entries(state.counters.startedBeforeApproval);
  const openConf = Object.values(state.conflicts).filter((c) => c.status === "open").length + BG_CONFLICTS.length;
  const risks = atRisk(state); const cs = catches(state); const k = counters(state); const ns = northStar(state);
  return (
    <div className="space-y-5">
      <PageTitle title="Dashboard" sub="Where every request is, what is at risk, and what Ava caught." />
      <div role="tablist" aria-label="Dashboard view" className="flex gap-1">
        {(["pipeline", "conflicts"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-md px-3 py-1.5 text-[13px]", tab === t ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100")}>{t === "pipeline" ? "Pipeline" : `Conflicts (${openConf} open)`}</button>)}
      </div>
      {tab === "conflicts" ? <ConflictsTable /> : <Board />}
      <section data-pulse="at-risk" aria-label="At risk"><Card><CardHead title={`At risk · ${risks.length}`} sub="Plan date is later than the next business day, or the handoff is blocked. Often that is the supplier’s wait, which the timing panel separates." />
        {risks.length ? <ul className="divide-y divide-slate-100">{risks.map((r) => (
          <li key={r.reqId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[13px]">
            {r.live ? <Link className="font-mono text-[12.5px] font-medium text-accent hover:underline" href={`/requests/${r.reqId}`}>{r.reqId}</Link> : <span className="font-mono text-[12.5px] text-slate-600">{r.reqId}</span>}
            <span className="font-medium">{r.title}</span>{!r.live && <Chip>Background</Chip>}
            <span className="ml-auto text-[12.5px] text-slate-500">{r.predicted ? `Predicted ${r.predicted}` : ""}</span>
            <p className="basis-full text-[12.5px] text-amber-900">{r.reason}</p>
          </li>))}</ul> : <p className="px-4 py-3 text-[13px] text-slate-500">Nothing at risk.</p>}</Card></section>
      <section aria-label="Ava caught this"><Card><CardHead title={`Ava caught this · ${cs.length}`} sub="Problems found in email and attachments, with the money or risk at stake. Amounts computed by code." />
        <ul className="divide-y divide-slate-100">{cs.slice(0, 8).map((c, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[13px]">
            <span className={cx("w-[96px] shrink-0 font-mono text-[13px] font-semibold", c.impact ? "text-slate-900" : "text-slate-500")}>{c.impact ? lakh(c.impact) : "Risk"}</span>
            <span className="min-w-0 flex-1"><span className="font-medium">{c.text}:</span> {c.impactText}. <span className="text-slate-500">{c.supplier} · {c.live ? <Link className="text-accent hover:underline" href={`/requests/${c.reqId}`}>{c.reqId}</Link> : c.reqId}</span></span>
            <StateChip state={c.status === "open" ? "open" : "resolved"} />{!c.live && <Chip>Background</Chip>}
          </li>))}</ul></Card></section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="₹ at stake caught" value={lakh(k.atStake)} sub="Over-charges, credits and savings found" tone="green" />
        <Stat label="Touches per request" value={ns.total ? ns.touches.toFixed(1) : "–"} sub="People decisions per request. Lower is better." />
        <Stat label="Started in Ask Ava" value={`${ns.fromAsk} / ${ns.total}`} sub="Before any supplier email" />
        <Stat label="Clean and fast" value={`${ns.good} / ${ns.total}`} sub="North star: complete, never withdrawn, Prayaan time under 1 day" tone="green" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests captured from email" value={ids.length + BACKGROUND.length} sub={`${ids.length} in this session, ${BACKGROUND.length} background`} />
        <Stat label="Questions answered from documents" value={state.counters.answeredFromDocs + BACKGROUND.reduce((n, b) => n + b.checks, 0)} sub="instead of asking people" />
        <Stat label="Approvals reopened by changed facts" value={state.counters.approvalsReopened} tone={state.counters.approvalsReopened ? "red" : undefined} />
        <Stat label="Started before approval" value={sba.reduce((n, [, v]) => n + v, 0) + 1} sub={[...sba.map(([d, v]) => `${d}: ${v}`), "Marketing Ops: 1 (background)"].join(", ")} />
      </div>
      <p className="text-[12px] text-slate-500">Activity, for context and not a measure of success: Ava took {k.avaActions} actions (each contract check counts as one), people made {k.decisions} decisions, and {k.checks} contract terms were checked. Ava sent {ns.autoSent} routine message{ns.autoSent === 1 ? "" : "s"} on her own.</p>
      <p className="text-[12px] text-slate-500">Background requests are other teams&apos; work in the same week. They are not part of the guided demo and never change its numbers.</p>
      <div className="grid gap-5 lg:grid-cols-2"><AdviceCard /><PredictionCard /></div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="min-w-0"><div data-pulse="timing"><CardHead title="Timing" sub="First message to Ready, split into the supplier’s wait and Prayaan’s own time (target: under 1 day)." />
          <div className="space-y-3 break-words px-4 py-3 text-[13px]">
            {ids.length === 0 && <p className="text-slate-500">No requests in this session yet.</p>}
            {ids.map((id) => { const t = timingFor(state, id); const r = state.requests[id]; return (
              <div key={id} className="min-w-0"><div className="font-medium"><Link className="text-accent hover:underline" href={`/requests/${id}`}>{id}</Link> {r.title}</div>
                {r.readyAt ? <p>First email {fmtDT(t.firstAt)}. Ready {fmtDT(r.readyAt)}. Took {timeLine(state, id)}{t.longest && ` Longest wait: ${t.longest}.`}</p>
                  : <p className="text-slate-600">First email {fmtDT(t.firstAt)}. Open for {t.days} business day{t.days === 1 ? "" : "s"}; Prayaan only {Math.round(waitSplit(state, id).own * 10) / 10} h so far.{t.longest && ` Longest wait so far: ${t.longest}.`}</p>}</div>); })}
          </div></div></Card>
        <Card className="min-w-0"><CardHead title="Changes feed" sub="Facts that changed, and the approvals they reopened." />
          <ul className="max-h-[360px] divide-y divide-slate-100 overflow-auto break-words text-[13px]">
            {state.changes.length === 0 && <li className="px-4 py-3 text-slate-500">No changes yet.</li>}
            {[...state.changes].reverse().map((c) => { const short = (v: string) => (c.field.startsWith("Amount") ? lakh(parseAmount(v)) : v); return (
              <li key={c.id} className="px-4 py-2"><div className="flex justify-between gap-2 text-[12px] text-slate-500"><Link className="text-accent hover:underline" href={`/requests/${c.requestId}`}>{c.requestId}</Link><span>{fmtDT(c.at)}</span></div>
                <div><b>{c.field}</b>: {short(c.old)} → <b>{short(c.new)}</b> <SourceLink src={c.source} /></div>{c.reopened.length > 0 && <div className="text-red-700">Reopened: {c.reopened.join(", ")}</div>}</li>); })}
          </ul></Card>
        <Card className="min-w-0"><CardHead title="Invoices with no request" sub="Spend that arrived without a request, contract or PO." />
          <div className="space-y-3 p-4 text-[13px]">
            {state.orphans.length === 0 && <Empty>None.</Empty>}
            {state.orphans.map((o) => { const sup = state.suppliers.find((s) => s.id === o.supplierId); return (
              <div key={o.id} className="rounded-md border border-amber-300 bg-amber-50/50 p-3">
                <div className="flex justify-between gap-2"><b>{o.invoiceNo}</b><span className="tabular">{lakh(o.amount)} + GST</span></div>
                <div>{supplierShort(sup?.name)}: {o.desc}</div><div className="text-[12px] text-slate-500">Received {fmtDT(o.createdAt)} · <SourceLink src={o.source} /></div>
                {o.status === "open" && o.likelyOwnerId && <div className="mt-2 rounded bg-white p-2 ring-1 ring-amber-200"><div className="text-[12px] text-slate-500">To {personName(o.likelyOwnerId)}:</div>“Looks like you&apos;re working with {supplierShort(sup?.name)}. Confirm in 60 seconds and we&apos;ll cover you.”
                  <div className="mt-1.5 flex gap-1.5">{viewAs === o.likelyOwnerId ? <><Button small variant="primary" onClick={() => act({ type: "orphan_confirm", orphanId: o.id })}>Confirm</Button><Button small onClick={() => act({ type: "orphan_not_mine", orphanId: o.id })}>Not mine</Button></> : <button className="text-[12px] text-accent underline" onClick={() => setViewAs(o.likelyOwnerId!)}>View as {personName(o.likelyOwnerId)} to answer</button>}</div></div>}
                {o.status === "confirmed" && <div className="mt-1 text-emerald-800">Confirmed. Covered by <Link className="underline" href={`/requests/${o.requestId}`}>{o.requestId}</Link>.</div>}
                {o.status === "not_mine" && <div className="mt-1 text-amber-800">{personName(o.likelyOwnerId)} says not theirs. In Procurement&apos;s Unsorted tray.</div>}
              </div>); })}
          </div></Card>
      </div>
    </div>
  );
}
