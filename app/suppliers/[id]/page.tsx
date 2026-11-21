"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAva } from "@/lib/store";
import { analyze, computeCumulativeSpend, requestAmount } from "@/lib/engine/rules";
import { contractsFor, CONTRACTS, COST_CENTRES } from "@/lib/engine/world";
import { daysBetween, fmtDate, inr, istYmd, lakh } from "@/lib/format";
import { Card, CardHead, Chip, Empty, PageTitle, StateChip } from "@/components/ui";

export default function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAva((s) => s.state);
  const s = state.suppliers.find((x) => x.id === id);
  if (!s) return <Empty>Supplier not found.</Empty>;
  const today = istYmd(state.now);
  const reqs = state.requestOrder.map((r) => state.requests[r]).filter((r) => r.supplierId === id);
  const seed = contractsFor(id);
  const projects = [...new Set([...seed.filter((c) => c.project).map((c) => c.project!), ...reqs.map((r) => r.project)])];
  const ccs = [...new Set([...seed.filter((c) => c.costCentre).map((c) => c.costCentre!), ...reqs.map((r) => r.costCentre)])];
  const docs = reqs.flatMap((r) => analyze(state, r.id).folded.documents.map((d) => ({ ...d, req: r.id })));
  return (
    <div className="space-y-5">
      <PageTitle title={s.name} sub={`${s.category}${s.city ? `, ${s.city}` : ""} · ${s.domain}`} right={s.known ? <Chip tone="green">In supplier list</Chip> : <Chip tone="amber">Not in supplier list</Chip>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHead title="90-day spend by cost centre" sub={`Before GST, rolling 90 days to ${fmtDate(today)}. Limit ₹25L per supplier and cost centre.`} />
          <ul className="divide-y divide-slate-100 text-[13px]">{ccs.map((cc) => { const sp = computeCumulativeSpend(CONTRACTS, state.requestOrder.map((rid) => ({ id: rid, title: state.requests[rid].title, supplierId: state.requests[rid].supplierId, costCentre: state.requests[rid].costCentre, amount: requestAmount(state, rid) })), id, cc, today); return (
            <li key={cc} className="flex items-center justify-between px-4 py-2"><span>{cc} ({COST_CENTRES.find((c) => c.id === cc)?.name ?? ""})<div className="text-[12px] text-slate-500">{sp.text}</div></span><span className={sp.overLimit ? "font-semibold text-red-700" : "font-semibold"}>{lakh(sp.total)}</span></li>); })}</ul></Card>
        <Card><CardHead title="Contacts" /><ul className="px-4 py-3 text-[13px]">{s.contacts.map((c) => <li key={c.email}>{c.name}, {c.title} · {c.email}</li>)}</ul>
          <CardHead title="Projects" /><ul className="px-4 py-3 text-[13px]">{projects.map((p) => <li key={p}>{p}</li>)}</ul></Card>
        <Card><CardHead title="Requests" /><ul className="divide-y divide-slate-100 text-[13px]">{reqs.length ? reqs.map((r) => <li key={r.id} className="flex items-center justify-between px-4 py-2"><Link className="text-accent hover:underline" href={`/requests/${r.id}`}>{r.id} {r.title}</Link><StateChip state={analyze(state, r.id).handoff.state} /></li>) : <li className="px-4 py-3 text-slate-500">None yet.</li>}</ul></Card>
        <Card><CardHead title="Documents and expiry dates" />
          <ul className="divide-y divide-slate-100 text-[13px]">
            {seed.map((c) => <li key={c.id} className="px-4 py-2"><b>{c.id}</b> {c.title}{c.amount ? ` · ${inr(c.amount)}` : ""} · {fmtDate(c.date)}{c.expiry && <span className={daysBetween(today, c.expiry) < 60 ? " text-amber-700" : ""}> · expires {fmtDate(c.expiry)}</span>}{c.note && <div className="text-[12px] text-slate-500">{c.note}</div>}</li>)}
            {docs.map((d) => <li key={d.attachmentId} className="px-4 py-2">{d.name} <span className="text-slate-500">({d.docType.replace("_", " ")}, {d.req})</span>{d.expiry && ` · valid until ${fmtDate(d.expiry)}`}</li>)}
          </ul></Card>
      </div>
    </div>
  );
}
