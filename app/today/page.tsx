"use client";
// Today: what Ava handled for you, what needs your decision, and what is coming up (Part 3.3).
import { useMemo, useState } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { deriveItems } from "@/lib/engine/items";
import { analyze } from "@/lib/engine/rules";
import { currentPlan } from "@/lib/engine/ai";
import { person, personName } from "@/lib/engine/world";
import { BACKGROUND, bgNeedCount, type BgNeed, type Bg } from "@/lib/background";
import { fmtDT, fmtShort, hoursBetween } from "@/lib/format";
import { ItemCard, due } from "@/components/ItemCard";
import { AiLabel } from "@/components/ai";
import { Card, CardHead, Chip, cx, Empty, PageTitle, StateChip } from "@/components/ui";
import type { State } from "@/lib/types";

const DEPTS = [["karan", "Procurement"], ["meera", "InfoSec"], ["suresh", "Finance"], ["farah", "Legal"], ["ananya", "Budget owner (Ananya)"], ["deepa", "Budget owner (Deepa)"], ["ritu", "Budget owner (Ritu)"], ["vikram", "VP"], ["rahul", "Requester (Rahul)"], ["neha", "Requester (Neha)"]];

function involved(state: State, id: string, who: string) {
  const r = state.requests[id]; const a = analyze(state, id);
  if (who === "karan") return true;
  if (r.requesterId === who) return true;
  if (a.approvals.some((x) => x.approverId === who)) return true;
  if (a.checklist.some((c) => c.ownerId === who)) return true;
  if (who === "suresh" && (a.handoff.state === "ready_po" || r.type === "renewal")) return true;
  return false;
}

export default function TodayPage() {
  const { state, viewAs, setViewAs } = useAva();
  const [all, setAll] = useState(false);
  // Earliest due date first, so whatever is overdue is at the top.
  const items = useMemo(() => deriveItems(state).filter((i) => i.personId === viewAs).sort((x, y) => due(state.items[x.key]?.openedAt ?? state.now).localeCompare(due(state.items[y.key]?.openedAt ?? state.now))), [state, viewAs]);
  const p = person(viewAs); const first = personName(viewAs).split(" ")[0];
  const since = (at: string) => hoursBetween(at, state.now) <= 36 && at <= state.now;
  const handled = [
    ...state.requestOrder.filter((id) => involved(state, id, viewAs)).flatMap((id) => state.requests[id].timeline.filter((t) => (!t.actor || t.actor === "ava") && since(t.at)).map((t) => ({ at: t.at, text: t.text, req: id }))),
    ...BACKGROUND.flatMap((b) => b.avaDid.filter((d) => d.for.includes(viewAs) && since(d.at)).map((d) => ({ at: d.at, text: d.text, req: b.id }))),
  ].sort((x, y) => y.at.localeCompare(x.at));
  const bgNeeds = BACKGROUND.flatMap((b) => b.needs.filter((n) => n.personId === viewAs).map((n) => ({ b, n })));
  const coming = [
    ...state.requestOrder.flatMap((id) => currentPlan(state, id).v.output.steps.filter((s) => s.ownerId === viewAs && s.status !== "done").map((s) => ({ req: id, title: s.title, eta: s.eta, live: true }))),
    ...BACKGROUND.flatMap((b) => b.plan.steps.filter((s) => s.ownerId === viewAs && s.status !== "done").map((s) => ({ req: b.id, title: s.title, eta: s.eta ?? undefined, live: false }))),
  ];
  const myRequests = state.requestOrder.map((id) => state.requests[id]).filter((r) => r.requesterId === viewAs);
  const n = items.length + bgNeeds.length;
  return (
    <div>
      <PageTitle title={`Today for ${first}`} sub={`${fmtDT(state.now)} · ${p?.title ?? ""}. Ava does the legwork; you make the decisions.`} />
      <div role="tablist" aria-label="Person" className="mb-5 flex flex-wrap gap-1">
        {DEPTS.map(([id, label]) => { const k = deriveItems(state).filter((i) => i.personId === id).length + bgNeedCount(id); return (
          <button key={id} role="tab" aria-selected={viewAs === id} onClick={() => setViewAs(id)} className={cx("rounded-md border px-2.5 py-1 text-[12.5px]", viewAs === id ? "border-accent bg-accent-50 font-semibold text-accent-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>{label}{k > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10.5px] font-bold text-white">{k}</span>}</button>); })}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section data-pulse="items" aria-label="Needs your decision" className="space-y-3">
            <h2 className="text-[16px] font-semibold">Needs your decision <span className="font-normal text-slate-500">· {n}</span></h2>
            {n === 0 && <Empty>Nothing needs {first}’s decision right now.</Empty>}
            {items.map((it) => <ItemCard key={it.key} it={it} />)}
            {bgNeeds.map(({ b, n }) => <BgNeedCard key={b.id + n.question} b={b} n={n} />)}
          </section>
          <section aria-label="Coming up"><Card><CardHead title="Coming up" sub="Your next steps from Ava’s plans." />
            {coming.length ? <ul className="divide-y divide-slate-100">{coming.map((c, i) => <li key={i} className="flex items-baseline gap-3 px-4 py-2 text-[13px]"><span className="w-[88px] shrink-0 text-slate-500">{c.eta ?? "No date"}</span><span className="flex-1">{c.title}</span>{c.live ? <Link className="font-mono text-[12px] text-accent hover:underline" href={`/requests/${c.req}`}>{c.req}</Link> : <span className="font-mono text-[12px] text-slate-500">{c.req}</span>}</li>)}</ul> : <p className="px-4 py-3 text-[13px] text-slate-500">Nothing planned for you.</p>}</Card></section>
        </div>
        <div className="space-y-4">
          <Card><CardHead title={`Since yesterday, Ava handled ${handled.length} thing${handled.length === 1 ? "" : "s"} for you`} sub="Read, filed, checked, drafted and planned. Nothing here needed you." />
            <ul className="divide-y divide-slate-100">{(all ? handled : handled.slice(0, 8)).map((h, i) => <li key={i} className="px-4 py-2 text-[12.5px]"><div className="text-[11.5px] text-slate-500">{fmtShort(h.at)} · <span className="font-mono">{h.req}</span></div>{h.text}</li>)}</ul>
            {handled.length > 8 && <button onClick={() => setAll(!all)} className="w-full border-t border-slate-100 px-4 py-2 text-left text-[12.5px] font-medium text-accent">{all ? "Show fewer" : `Show all ${handled.length}`}</button>}
          </Card>
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

function BgNeedCard({ b, n }: { b: Bg; n: BgNeed }) {
  const r = n.rec ?? (b.conflict ? b.conflict.rec : undefined);
  const conf = r?.confidence === "high" ? "bg-emerald-100 text-emerald-800" : r?.confidence === "medium" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700";
  return (
    <Card>
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500"><span><span className="font-mono">{b.id}</span> · {b.supplier} › {b.project}</span><Chip tone={n.kind === "conflict" ? "red" : n.kind === "approval" ? "amber" : "grey"}>{n.kind === "conflict" ? "Conflict" : n.kind === "approval" ? "Approval" : n.kind === "question" ? "Question" : n.kind === "legal" ? "Legal review" : n.kind === "retro" ? "Early start" : "For you"}</Chip></div>
        <p className="mt-1.5 text-[14.5px] font-medium text-slate-900">{n.question}</p>
        {r && <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/50 px-3.5 py-3"><div className="mb-1 flex items-center gap-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-violet-900">Ava recommends</span><span className={cx("rounded px-1.5 text-[10.5px] font-semibold", conf)}>{r.confidence} confidence</span><AiLabel source="cached" /></div>
          {"bullets" in r && r.bullets ? <ul className="list-disc space-y-0.5 pl-5 text-[13px]">{r.bullets.map((x) => <li key={x}>{x}</li>)}</ul> : <><p className="text-[13.5px] font-medium">{r.recommendation}</p>{r.reasoning && <p className="text-[12.5px] text-slate-700">{r.reasoning}</p>}</>}
          {r.draft && <details className="mt-1.5 text-[12.5px]"><summary className="cursor-pointer text-violet-900">See the ready draft</summary><pre className="mt-1 whitespace-pre-wrap rounded border border-violet-100 bg-white px-2.5 py-2 font-sans">{r.draft}</pre></details>}
        </div>}
        <p className="mt-2 text-[12px] text-slate-500">Background request from another team. Decisions on it are outside the guided demo.</p>
      </div>
    </Card>
  );
}

function ProcurementSide() {
  const state = useAva((s) => s.state);
  const open = Object.values(state.conflicts).filter((c) => c.status === "open").length + BACKGROUND.filter((b) => b.conflict).length;
  return (
    <Card><CardHead title="Procurement owns every request" sub="Every request, conflict and exception, plus the Unsorted tray." />
      <ul className="space-y-1 px-4 py-3 text-[13px]">
        <li><Link className="text-accent hover:underline" href="/requests">{state.requestOrder.length + BACKGROUND.length} requests</Link></li>
        <li><Link className="text-accent hover:underline" href="/conflicts">{open} open conflicts</Link></li>
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

