"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAva } from "@/lib/store";
import { analyze, type Analysis } from "@/lib/engine/rules";
import { personName } from "@/lib/engine/world";
import { timingFor } from "@/lib/engine/timing";
import { fmtDT, lakh } from "@/lib/format";
import { ApprovalsView, ChecklistView, DocumentsPanel, DraftBox, FactsTable, HandoffPacket, RoutingPanel, TimelineView } from "@/components/request";
import ConflictCard from "@/components/ConflictCard";
import { Card, CardHead, Chip, cx, Empty, StateChip, supplierShort } from "@/components/ui";
import { Icon } from "@/components/icons";
import { summarize } from "@/lib/summary";
import { ActsBanner, AvaDid, AvaPlan, AvaRead, ContractCard, useLiveAi } from "@/components/ai";
import { ItemCard } from "@/components/ItemCard";
import { deriveItems } from "@/lib/engine/items";
import { predictionHit, ownerName } from "@/lib/engine/ai";
import { BACKGROUND, bgState, bgTotal90, type Bg } from "@/lib/background";
import { AiLabel, CiteChip } from "@/components/ai";

type Tab = "facts" | "documents" | "approvals" | "timeline" | "packet";
const HASH_TAB: Record<string, Tab> = { routing: "approvals", approvals: "approvals", checklist: "approvals", documents: "documents", timeline: "timeline", packet: "packet", facts: "facts" };
const PULSE_TAB: Record<string, Tab> = { routing: "approvals", approvals: "approvals", documents: "documents", handoff: "packet" };

type StageState = "done" | "current" | "blocked" | "todo";
function stages(a: Analysis) {
  const req = a.requiredFacts.map((k) => a.facts[k]);
  const factsOk = req.filter((f) => f.displayState === "confirmed").length;
  const checks = a.checklist.filter((c) => !["budget", "vp"].includes(c.key));
  const checksOk = checks.filter((c) => ["done", "excepted", "legal_review"].includes(c.status)).length;
  const apOk = a.approvals.filter((x) => x.status === "approved" || x.status === "reconfirmed").length;
  const stale = a.approvals.some((x) => x.status === "needs_reconfirmation");
  const contradicted = req.some((f) => f.displayState === "contradicted");
  const ready = a.handoff.state === "ready_legal" || a.handoff.state === "ready_po";
  const s: { label: string; detail: string; state: StageState; tab: Tab }[] = [
    { label: "Captured", detail: `${a.req.emailIds.length} email${a.req.emailIds.length === 1 ? "" : "s"}`, state: "done", tab: "timeline" as Tab },
    { label: "Facts", detail: `${factsOk}/${req.length} confirmed`, state: contradicted ? "blocked" : factsOk === req.length ? "done" : "todo", tab: "facts" },
    { label: "Checks", detail: `${checksOk}/${checks.length} closed`, state: checksOk === checks.length ? "done" : "todo", tab: "approvals" },
    { label: "Approvals", detail: stale ? "reopened" : `${apOk}/${a.approvals.length} signed`, state: stale ? "blocked" : apOk === a.approvals.length ? "done" : "todo", tab: "approvals" },
    { label: a.routing.endState === "legal" ? "Legal Review" : "Issue PO", detail: ready ? "handed off" : a.handoff.state === "blocked" ? "blocked" : "not yet", state: ready ? "done" : a.handoff.state === "blocked" ? "blocked" : "todo", tab: ready ? "packet" : "approvals" },
  ];
  const k = s.findIndex((x) => x.state !== "done");
  if (k >= 0 && s[k].state === "todo") s[k].state = "current";
  return s;
}

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAva((s) => s.state); const pulse = useAva((s) => s.pulse);
  const [tab, setTab] = useState<Tab>("facts");
  const [routingOpen, setRoutingOpen] = useState(false);
  useEffect(() => {
    const sync = () => { const h = window.location.hash.slice(1); if (HASH_TAB[h]) setTab(HASH_TAB[h]); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, [id]);
  useEffect(() => { if (pulse.target && PULSE_TAB[pulse.target]) setTab(PULSE_TAB[pulse.target]); setRoutingOpen(pulse.target === "routing"); }, [pulse.n, pulse.target]);
  useLiveAi(id);
  const viewAs = useAva((s) => s.viewAs);
  const req = state.requests[id];
  const bg = BACKGROUND.find((b) => b.id === id);
  if (!req && bg) return <BgRequest b={bg} />;
  if (!req) return <Empty>Request {id} does not exist in this session yet. <Link className="text-accent underline" href="/requests">See all requests</Link></Empty>;
  const a = analyze(state, id);
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  const conflicts = Object.values(state.conflicts).filter((c) => c.requestId === id).sort((x, y) => (x.status === y.status ? y.openedAt.localeCompare(x.openedAt) : x.status === "open" ? -1 : 1));
  const openConf = conflicts.filter((c) => c.status === "open");
  const drafts = state.drafts.filter((d) => d.requestId === id && !d.conflictId);
  const t = timingFor(state, id);
  const ready = a.handoff.state === "ready_legal" || a.handoff.state === "ready_po";
  const st = stages(a);
  const TABS: { k: Tab; label: string; badge?: number }[] = [
    { k: "facts", label: "Facts" }, { k: "documents", label: "Documents" }, { k: "approvals", label: "Approvals", badge: a.approvals.filter((x) => x.status === "needs_reconfirmation").length || undefined },
    { k: "timeline", label: "Timeline" }, ...(ready ? [{ k: "packet" as Tab, label: "Handoff packet" }] : []),
  ];
  const mine = deriveItems(state).filter((i) => i.requestId === id && i.personId === viewAs);
  const others = deriveItems(state).filter((i) => i.requestId === id && i.personId !== viewAs);
  const resolved = conflicts.filter((c) => c.status === "resolved");
  const hit = predictionHit(state, id);
  const summary = summarize(state, a);
  return (
    <div className="space-y-5">
      <header className="sticky top-14 z-10 -mx-4 border-b border-slate-200 bg-canvas/95 px-4 pb-3 pt-1 backdrop-blur sm:-mx-6 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-slate-500"><Link href="/requests" className="hover:underline">Requests</Link> › {sup ? <Link className="hover:underline" href={`/suppliers/${sup.id}`}>{supplierShort(sup.name)}</Link> : `Possible new supplier: ${req.supplierGuess?.name}`} › {req.project}</nav>
        <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-[20px] font-semibold tracking-[-0.01em]"><span className="font-mono text-slate-500">{req.id}</span> {req.title}</h1><StateChip state={a.handoff.state} />{req.startedBeforeApproval && <Chip tone="red">Started before approval</Chip>}</div>
        <p className={cx("mt-1 text-[14px] font-medium", a.handoff.state === "blocked" ? "text-red-800" : ready ? "text-emerald-800" : "text-slate-800")}>{summary}</p>
        <ol aria-label="Intake progress" className="mt-2 flex flex-wrap gap-1.5">
          {st.map((s, i) => (
            <li key={s.label}><button onClick={() => setTab(s.tab)} aria-label={`${s.label}: ${s.detail}${s.state === "blocked" ? ", blocked" : s.state === "done" ? ", done" : ""}`} className={cx("flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]", s.state === "blocked" ? "border-red-300 bg-red-50 text-red-800" : s.state === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : s.state === "current" ? "border-accent bg-accent-50 text-accent-700" : "border-slate-200 bg-white text-slate-600")}>
              <span aria-hidden className="font-semibold">{s.state === "done" ? "✓" : s.state === "blocked" ? "!" : i + 1}</span><span className="font-semibold">{s.label}</span><span className="hidden sm:inline">· {s.detail}</span>
            </button></li>
          ))}
        </ol>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3 lg:grid-cols-6">
        {[["Supplier", supplierShort(sup?.name ?? req.supplierGuess?.name)], ["Value (before GST)", lakh(a.requestAmount)], ["90-day total", lakh(a.spend.total)], ["Requester", personName(req.requesterId)], ["Owner", `${personName("karan")}, Procurement`], ["First email", fmtDT(t.firstAt)]].map(([k, v]) => (
          <div key={k}><dt className="text-[11.5px] text-slate-500">{k}</dt><dd className={cx("font-medium", k === "90-day total" && a.spend.overLimit && "text-red-700", (k.startsWith("Value") || k.startsWith("90")) && "font-mono")}>{v}</dd></div>
        ))}
      </dl>

      <div data-pulse="status">
        {a.handoff.banner ? (
          <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <p className="text-[15px] font-semibold text-red-800">{a.handoff.banner}</p>
            <p className="mt-0.5 text-[13px] text-red-800">{a.handoff.reasons.filter((r) => /reconfirmation|conflict/i.test(r)).join(" · ")}</p>
          </div>
        ) : ready ? (
          <div data-pulse="handoff" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="text-[15px] font-semibold">{a.handoff.state === "ready_legal" ? "Ready for Legal Review. The handoff packet went to Farah Khan." : "Ready to issue PO."} <ActsBanner req={req} /></p>
            <p className="text-[13px]">Took {t.days} business day{t.days === 1 ? "" : "s"} against a 1-day target.{t.longest && ` Longest wait: ${t.longest}.`}{hit && ` ${hit}`}</p>
          </div>
        ) : null}
      </div>

      <AvaRead reqId={id} />

      <section aria-label="Needs you" className="space-y-2">
        <h2 className="text-[15px] font-semibold">Needs you <span className="font-normal text-slate-500">· {personName(viewAs)}</span></h2>
        {mine.length ? mine.map((it) => <ItemCard key={it.key} it={it} compact />) : <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-[13px] text-slate-600">Nothing here needs {personName(viewAs).split(" ")[0]}.{others.length > 0 && " Waiting on others:"}</p>}
        {others.length > 0 && <ul className="flex flex-wrap gap-1.5 text-[12.5px]">{others.map((o) => <li key={o.key} className="rounded-full border border-slate-200 bg-white px-2.5 py-1"><b>{personName(o.personId)}</b>: {o.question.length > 70 ? o.question.slice(0, 68) + "…" : o.question}</li>)}</ul>}
      </section>

      <AvaPlan reqId={id} />

      <section data-pulse="problems" id="conflicts" aria-label="Problems Ava found" className="space-y-3">
        <h2 className="text-[15px] font-semibold">Problems Ava found <span className="font-normal text-slate-500">· {openConf.length} open{resolved.length ? `, ${resolved.length} resolved` : ""}. Ava never picks a side.</span></h2>
        {openConf.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-[13px] text-slate-600">No open problems.</p>}
        {openConf.map((c) => <ConflictCard key={c.id} c={c} />)}
        {resolved.length > 0 && <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold">Resolved ({resolved.length})</summary><div className="space-y-3 p-3">{resolved.map((c) => <ConflictCard key={c.id} c={c} />)}</div></details>}
        {drafts.length > 0 && <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold">Drafts for the requester ({drafts.length}) <span className="font-normal text-slate-500">· Ava never emails suppliers</span></summary><div className="space-y-2 border-t border-slate-100 p-3">{drafts.map((d) => <DraftBox key={d.id} d={d} />)}</div></details>}
      </section>

      <ContractCard a={a} />

      <AvaDid req={req} />

      <div role="tablist" aria-label="Request sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((x) => (
          <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={cx("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px]", tab === x.k ? "border-accent font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900")}>
            {x.label}{x.badge ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{x.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "approvals" && (
        <div className="space-y-4">
          <div data-pulse="approvals"><ApprovalsView a={a} /></div>
          <ChecklistView a={a} />
          <details data-pulse="routing" open={routingOpen} onToggle={(e) => setRoutingOpen((e.target as HTMLDetailsElement).open)} className="rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[14px] font-semibold"><Icon name="chevronRight" className={cx("text-slate-400 transition-transform", routingOpen && "rotate-90")} />Why these approvers? <span className="font-mono text-[12.5px] font-normal text-slate-500">{a.spend.text} in 90 days</span></summary>
            <div className="border-t border-slate-100"><RoutingPanel a={a} bare /></div>
          </details>
        </div>
      )}
      {tab === "facts" && <FactsTable a={a} />}
      {tab === "documents" && <div data-pulse="documents"><DocumentsPanel a={a} state={state} /></div>}
      {tab === "timeline" && <TimelineView a={a} />}
      {tab === "packet" && ready && <HandoffPacket a={a} state={state} />}
    </div>
  );
}

function BgRequest({ b }: { b: Bg }) {
  const state = useAva((s) => s.state);
  return (
    <div className="space-y-5">
      <header>
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-slate-500"><Link href="/requests" className="hover:underline">Requests</Link> › {b.supplier} › {b.project}</nav>
        <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-[20px] font-semibold"><span className="font-mono text-slate-500">{b.id}</span> {b.project}</h1><StateChip state={bgState(b)} /><Chip>Background</Chip></div>
        <p className="mt-1 text-[13px] text-slate-600">{b.supplier} · {lakh(b.amount)} · 90-day total {lakh(bgTotal90(b, state.now))} · {b.requester}, {b.dept} · Waiting on {b.waitingOn}</p>
      </header>
      <section className="rounded-xl border border-accent/25 bg-gradient-to-b from-accent-50/70 to-white px-4 py-3.5"><div className="mb-1.5 flex items-center gap-2"><h2 className="text-[14px] font-semibold">Ava’s read</h2><AiLabel source="cached" /></div><p className="text-[14.5px] leading-[1.6]">{b.read.join(" ")}{b.conflict?.clauses.map((c) => <CiteChip key={c} c={{ type: "clause", id: c }} />)}</p></section>
      <Card><CardHead title="Ava’s plan" sub={`Predicted ready: ${b.plan.predictedReady}. ${b.plan.predictionReason}`} right={<AiLabel source="cached" />} />
        <ol className="px-4 py-2">{b.plan.steps.map((s, i) => <li key={i} className="flex flex-wrap items-center gap-2 py-1.5 text-[13px]"><span className={cx("h-2.5 w-2.5 rounded-full", s.status === "done" ? "bg-emerald-600" : s.status === "in_progress" ? "bg-accent" : "border-2 border-slate-300")} /><span className={s.status === "done" ? "text-slate-500 line-through" : "font-medium"}>{s.title}</span>{s.source === "policy" ? <span className="rounded bg-blue-100 px-1.5 text-[10.5px] font-semibold text-blue-800">Required by policy</span> : <span className="rounded bg-violet-100 px-1.5 text-[10.5px] font-semibold text-violet-800">Added by Ava</span>}<span className="text-[12px] text-slate-500">{ownerName(s.ownerId, state)}{s.eta ? ` · by ${s.eta}` : ""}{s.reason ? ` · ${s.reason}` : ""}</span></li>)}</ol></Card>
      {b.conflict && <Card className="border-red-300"><CardHead title={`Problem Ava found: ${b.conflict.title}`} sub={b.conflict.impactText} />
        <div className="grid gap-3 px-4 py-3 text-[13px] md:grid-cols-2">{[b.conflict.a, b.conflict.b].map((x, i) => <div key={i}><div className="mb-1 font-semibold">{x.label}</div><div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">“{x.quote}”{x.clause && <CiteChip c={{ type: "clause", id: x.clause }} />}</div></div>)}</div>
        <div className="px-4 pb-4"><div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3.5 py-3 text-[13px]"><div className="mb-1 flex items-center gap-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-violet-900">Ava recommends</span><span className="rounded bg-emerald-100 px-1.5 text-[10.5px] font-semibold text-emerald-800">{b.conflict.rec.confidence} confidence</span><AiLabel source="cached" /></div><p className="font-medium">{b.conflict.rec.recommendation}</p><p className="text-slate-700">{b.conflict.rec.reasoning}</p></div></div></Card>}
      <Card><CardHead title={`Ava did ${b.avaActions} things · people made ${b.decisions} decisions`} /><ul className="px-4 py-2 text-[12.5px]">{b.avaDid.map((d, i) => <li key={i} className="py-0.5"><span className="text-slate-500">{fmtDT(d.at)}</span> · {d.text}</li>)}</ul></Card>
      <p className="text-[12px] text-slate-500">Background request from another team. It is sample data with cached AI output, outside the guided demo.</p>
    </div>
  );
}
