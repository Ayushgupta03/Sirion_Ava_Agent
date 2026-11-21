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

type Tab = "overview" | "facts" | "checks" | "documents" | "timeline" | "packet";
const HASH_TAB: Record<string, Tab> = { routing: "overview", conflicts: "overview", approvals: "overview", checklist: "checks", documents: "documents", timeline: "timeline", packet: "packet", facts: "facts" };
const PULSE_TAB: Record<string, Tab> = { routing: "overview", approvals: "overview", conflicts: "overview", status: "overview", documents: "documents" };

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
    { label: "Captured", detail: `${a.req.emailIds.length} email${a.req.emailIds.length === 1 ? "" : "s"}`, state: "done", tab: "timeline" },
    { label: "Facts", detail: `${factsOk}/${req.length} confirmed`, state: contradicted ? "blocked" : factsOk === req.length ? "done" : "todo", tab: "facts" },
    { label: "Checks", detail: `${checksOk}/${checks.length} closed`, state: checksOk === checks.length ? "done" : "todo", tab: "checks" },
    { label: "Approvals", detail: stale ? "reopened" : `${apOk}/${a.approvals.length} signed`, state: stale ? "blocked" : apOk === a.approvals.length ? "done" : "todo", tab: "overview" },
    { label: a.routing.endState === "legal" ? "Legal Review" : "Issue PO", detail: ready ? "handed off" : a.handoff.state === "blocked" ? "blocked" : "not yet", state: ready ? "done" : a.handoff.state === "blocked" ? "blocked" : "todo", tab: ready ? "packet" : "overview" },
  ];
  const k = s.findIndex((x) => x.state !== "done");
  if (k >= 0 && s[k].state === "todo") s[k].state = "current";
  return s;
}

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAva((s) => s.state); const pulse = useAva((s) => s.pulse);
  const [tab, setTab] = useState<Tab>("overview");
  const [routingOpen, setRoutingOpen] = useState(false);
  useEffect(() => {
    const sync = () => { const h = window.location.hash.slice(1); if (HASH_TAB[h]) setTab(HASH_TAB[h]); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, [id]);
  useEffect(() => { if (pulse.target && PULSE_TAB[pulse.target]) setTab(PULSE_TAB[pulse.target]); setRoutingOpen(pulse.target === "routing"); }, [pulse.n, pulse.target]);
  const req = state.requests[id];
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
    { k: "overview", label: "Overview", badge: openConf.length || undefined }, { k: "facts", label: "Facts" }, { k: "checks", label: "Checklist" },
    { k: "documents", label: "Documents" }, { k: "timeline", label: "Timeline" }, ...(ready ? [{ k: "packet" as Tab, label: "Handoff packet" }] : []),
  ];
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
        {[["Value (before GST)", lakh(a.requestAmount)], ["90-day total", lakh(a.spend.total)], ["Requester", personName(req.requesterId)], ["Cost centre", req.costCentre], ["Owner", `${personName("karan")}, Procurement`], ["First email", fmtDT(t.firstAt)]].map(([k, v]) => (
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
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="text-[15px] font-semibold">{a.handoff.state === "ready_legal" ? "Ready for Legal Review. The handoff packet went to Farah Khan." : "Ready to issue PO."}</p>
            <p className="text-[13px]">Took {t.days} business day{t.days === 1 ? "" : "s"} against a 1-day target.{t.longest && ` Longest wait: ${t.longest}.`}</p>
          </div>
        ) : null}
      </div>

      <div role="tablist" aria-label="Request sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((x) => (
          <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={cx("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px]", tab === x.k ? "border-accent font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900")}>
            {x.label}{x.badge ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{x.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          {openConf.length > 0 && <section data-pulse="conflicts" id="conflicts" className="space-y-3"><h2 className="text-[15px] font-semibold">Open conflicts. Ava never picks a side.</h2>{openConf.map((c) => <ConflictCard key={c.id} c={c} />)}</section>}
          <div data-pulse="approvals"><ApprovalsView a={a} /></div>
          <details data-pulse="routing" open={routingOpen} onToggle={(e) => setRoutingOpen((e.target as HTMLDetailsElement).open)} className="rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[14px] font-semibold"><Icon name="chevronRight" className={cx("text-slate-400 transition-transform", routingOpen && "rotate-90")} />Why these approvers? <span className="font-mono text-[12.5px] font-normal text-slate-500">{a.spend.text} in 90 days</span></summary>
            <div className="border-t border-slate-100"><RoutingPanel a={a} bare /></div>
          </details>
          {drafts.length > 0 && <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold">Drafts for the requester ({drafts.length}) <span className="font-normal text-slate-500">· Ava never emails suppliers</span></summary><div className="space-y-2 border-t border-slate-100 p-3">{drafts.map((d) => <DraftBox key={d.id} d={d} />)}</div></details>}
          {conflicts.filter((c) => c.status === "resolved").length > 0 && <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold">Resolved conflicts ({conflicts.filter((c) => c.status === "resolved").length})</summary><div className="space-y-3 p-3">{conflicts.filter((c) => c.status === "resolved").map((c) => <ConflictCard key={c.id} c={c} />)}</div></details>}
        </div>
      )}
      {tab === "facts" && <FactsTable a={a} />}
      {tab === "checks" && <ChecklistView a={a} />}
      {tab === "documents" && <div data-pulse="documents"><DocumentsPanel a={a} state={state} /></div>}
      {tab === "timeline" && <TimelineView a={a} />}
      {tab === "packet" && ready && <HandoffPacket a={a} state={state} />}
    </div>
  );
}
