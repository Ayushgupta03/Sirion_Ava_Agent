"use client";
import { Fragment, useState } from "react";
import type { ApprovalKey, Draft, State } from "@/lib/types";
import type { Analysis, ApprovalView } from "@/lib/engine/rules";
import { useAva } from "@/lib/store";
import { actionsOf, currentRead } from "@/lib/engine/ai";
import { AiLabel } from "./ai";
import { contractsFor, firstName, personName } from "@/lib/engine/world";
import { fmtDate, fmtDT, fmtShort, inr, lakh } from "@/lib/format";
import { docDiff } from "@/lib/engine/facts";
import { Button, Card, CardHead, Chip, cx, Quote, SourceLink, StateChip, supplierShort } from "./ui";

export function FactsTable({ a }: { a: Analysis }) {
  const act = useAva((s) => s.act); const viewAs = useAva((s) => s.viewAs);
  const order = ["amount", "scope", "start_date", "duration", "data_access", "auto_renew", "supplier_entity", "requester", "cost_centre", "gst", "total", "payment_terms", "validity"];
  const keys = [...order.filter((k) => a.facts[k]), ...Object.keys(a.facts).filter((k) => !order.includes(k) && k !== "notice_period")];
  const [hist, setHist] = useState<string | null>(null);
  return (
    <Card id="facts">
      <CardHead title="Facts" sub="Each value links to the sentence or line it came from. Required facts must be confirmed before handoff." />
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-slate-100 text-left text-[12px] text-slate-500"><th className="px-4 py-2 font-medium">Field</th><th className="px-2 py-2 font-medium">Value</th><th className="px-2 py-2 font-medium">State</th><th className="px-2 py-2 font-medium">Source</th><th className="px-2 py-2 font-medium">Versions</th><th className="px-2 py-2" /></tr></thead>
          <tbody>
            {keys.map((k) => { const f = a.facts[k]; const val = k === "amount" || k === "gst" || k === "total" ? (f.num != null ? inr(f.num) : f.value) : k === "data_access" && f.num != null ? (f.num && !/^yes/i.test(f.value) ? `Yes. ${f.value}` : f.value) : f.value;
              return (<Fragment key={k}>
                <tr className="border-b border-slate-50 align-top">
                  <td className="px-4 py-2 text-slate-600">{f.label}{f.required && <span className="ml-1 text-slate-400" title="Required">*</span>}</td>
                  <td className="px-2 py-2 font-medium text-slate-900">{val || <span className="text-slate-400">Not found</span>}{f.said && f.origin === "document" && f.said.num != null && f.num != null && Math.abs(f.said.num - f.num) > 0.5 && <div className="text-[12px] font-normal text-slate-500">Said: {f.said.value} (<SourceLink src={f.said.source} />)</div>}</td>
                  <td className="px-2 py-2"><StateChip state={f.displayState} />{f.confirmedBy && <div className="mt-0.5 text-[11.5px] text-slate-500">by {personName(f.confirmedBy)}</div>}{f.origin === "document" && f.displayState === "confirmed" && <div className="mt-0.5 text-[11.5px] text-slate-500">by document</div>}</td>
                  <td className="px-2 py-2"><div className="flex flex-col gap-0.5">{f.sources.slice(0, 3).map((s, i) => <SourceLink key={i} src={s} />)}</div></td>
                  <td className="px-2 py-2">{f.versions.length > 1 ? <button className="text-[12px] text-accent underline" onClick={() => setHist(hist === k ? null : k)}>{f.versions.length} versions</button> : <span className="text-[12px] text-slate-400">1</span>}</td>
                  <td className="px-2 py-2 text-right">{f.displayState === "unconfirmed" && f.field !== "data_access" && <Button small onClick={() => act({ type: "confirm_fact", requestId: a.req.id, field: k })} title={`Confirm as ${personName(viewAs)}`}>Confirm</Button>}</td>
                </tr>
                {hist === k && <tr><td colSpan={6} className="bg-slate-50 px-4 py-2">
                  <ol className="space-y-1 text-[12.5px]">{f.versions.map((v, i) => <li key={i} className="flex items-center gap-2"><Chip tone={v.status === "current" ? "green" : "grey"}>{v.status === "current" ? "Current" : "Superseded"}</Chip><span className="font-medium">{k === "amount" && v.num ? inr(v.num) : v.value}</span><span className="text-slate-500">{fmtShort(v.at)}</span><SourceLink src={v.source} /></li>)}</ol>
                </td></tr>}
              </Fragment>); })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const CK_TONE: Record<string, string> = { done: "text-emerald-700", excepted: "text-accent-700", legal_review: "text-accent-700", pending: "text-amber-700", waiting_supplier: "text-amber-700" };
export function ChecklistView({ a }: { a: Analysis }) {
  return (
    <Card id="checklist">
      <CardHead title="Checklist" sub={`Type: ${a.req.type === "renewal" ? "software renewal" : a.req.type === "amendment" ? "repeat work under an existing agreement" : a.dataAccess === 1 ? "IT services consultant with customer data access" : a.req.type.replace("_", " ")}. Ava checks that documents are present and in date, never clause wording.`} />
      <ul className="divide-y divide-slate-50">
        {a.checklist.map((c) => (
          <li key={c.key} className="flex flex-wrap items-start gap-3 px-4 py-2.5">
            <span aria-hidden className={cx("mt-0.5 text-[15px]", CK_TONE[c.status])}>{c.status === "done" ? "✓" : c.status === "excepted" || c.status === "legal_review" ? "→" : "○"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.label}</span><StateChip state={c.status} /></div>
              <div className="text-[12.5px] text-slate-600">{c.how}{a.req.checklistDone[c.key] && <span className="text-slate-400"> · closed {fmtShort(a.req.checklistDone[c.key].at)}</span>}</div>
            </div>
            <span className="text-[12px] text-slate-500">{personName(c.ownerId)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RoutingPanel({ a, bare }: { a: Analysis; bare?: boolean }) {
  const supName = supplierShort(useAva.getState().state.suppliers.find((s) => s.id === a.req.supplierId)?.name) || "this supplier";
  const body = (
      <div className="px-4 py-3">
        <div className="mb-3 rounded-md bg-slate-50 px-3 py-2">
          <div className="text-[12px] font-medium text-slate-500">90-day spend, {supName} in {a.req.costCentre} (before GST, since {fmtDate(a.spend.windowStart)})</div>
          <table className="mt-1 w-full text-[13px] tabular"><tbody>
            {a.spend.lines.map((l) => <tr key={l.ref}><td className="py-0.5">{l.label}{l.date ? `, ${fmtDate(l.date)}` : ""}</td><td className="text-right">{inr(l.amount)}</td></tr>)}
            <tr className="border-t border-slate-200 font-semibold"><td className="py-1">90-day total</td><td className={cx("text-right", a.spend.overLimit && "text-red-700")}>{inr(a.spend.total)}</td></tr>
          </tbody></table>
        </div>
        <ol className="space-y-2">
          {a.routing.rules.map((r) => <li key={r.id} className="flex gap-2 text-[13px]"><Chip tone={r.fired ? "blue" : "grey"}>{r.title}</Chip><span>{r.text}</span></li>)}
        </ol>
        <p className="mt-3 text-[12px] text-slate-500">Rules are plain code, not AI. Each decision shows the rule and the numbers.</p>
      </div>
  );
  if (bare) return body;
  return <Card id="routing"><CardHead title="Why these approvers?" />{body}</Card>;
}

export function ApprovalsView({ a, compact }: { a: Analysis; compact?: boolean }) {
  return (
    <Card id="approvals">
      <CardHead title="Approvals" sub="Each approval is a Decision Receipt tied to the facts it was given for." />
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {a.approvals.map((ap) => <ReceiptCard key={ap.key} a={a} ap={ap} compact={compact} />)}
      </div>
    </Card>
  );
}

const KEY_LABEL: Record<ApprovalKey, string> = { budget_owner: "Budget owner", vp: "VP (over ₹25L)", infosec: "InfoSec" };
export function ReceiptCard({ a, ap, compact }: { a: Analysis; ap: ApprovalView; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const red = ap.status === "needs_reconfirmation";
  return (
    <div className={cx("rounded-lg border p-3", red ? "border-red-300 bg-red-50/40" : "border-slate-200")}>
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-[12px] font-medium text-slate-500">{KEY_LABEL[ap.key]}</div><div className="font-semibold">{personName(ap.approverId)}</div></div>
        <StateChip state={ap.status} />
      </div>
      <div className="mt-2 text-[13px] text-slate-700">{snapText(a, ap)}</div>
      {red && <div className="mt-2 rounded-md bg-white px-2.5 py-2 text-[12.5px] text-red-800 ring-1 ring-red-200">{ap.diffs.map((d) => `Given for ${d.old}. Current: ${d.new}.`).join(" ")}{ap.reopenSource && ` Source: ${ap.reopenSource}.`}</div>}
      {ap.last && <div className="mt-2 text-[12px] text-slate-500">Last receipt: {ap.last.kind} by {personName(ap.last.by)}, {fmtDT(ap.last.at)}</div>}
      {ap.status === "pending" && !ap.gateOpen && <div className="mt-2 text-[12px] text-slate-500">Not sent yet: waiting for a confirmed amount and answered questions.</div>}
      {!compact && <div className="mt-2"><Button small variant={ap.status === "pending" || red ? "primary" : "secondary"} onClick={() => setOpen(true)}>Open Decision Receipt</Button></div>}
      {open && <ReceiptModal a={a} ap={ap} onClose={() => setOpen(false)} />}
    </div>
  );
}

function snapText(a: Analysis, ap: ApprovalView) {
  if (ap.key === "budget_owner") return `${lakh(a.requestAmount)} for ${a.req.project}${a.retro ? ` (${lakh(a.amount)} + ${lakh(a.retro)} already invoiced)` : ""}`;
  if (ap.key === "vp") return `${lakh(a.spend.total)} 90-day total for ${supplierShort(useAva.getState().state.suppliers.find((s) => s.id === a.req.supplierId)?.name)} in ${a.req.costCentre}${a.req.exceptions.some((e) => e.kind !== "retro") ? ", plus the competing-quote exception" : ""}`;
  return "Supplier access to customer data, and the security certificate";
}

export function ReceiptModal({ a, ap, onClose }: { a: Analysis; ap: ApprovalView; onClose: () => void }) {
  const viewAs = useAva((s) => s.viewAs); const act = useAva((s) => s.act); const setViewAs = useAva((s) => s.setViewAs);
  const canAct = viewAs === ap.approverId;
  const quoteDocs = a.folded.documents.filter((d) => ["quote", "order_form", "sow"].includes(d.docType));
  const checked = a.checklist.filter((c) => c.status === "done");
  const docFacts = Object.values(a.facts).filter((f) => f.origin === "document" && f.displayState === "confirmed" && f.required);
  const msa = contractsFor(a.req.supplierId).find((c) => c.type === "MSA");
  const notChecked = [
    msa?.autoRenew ? `The auto-renewal clause in the MSA (${msa.renewalTerms})` : msa ? `Clause wording in the ${msa.title}` : "Clause wording of any agreement",
    ...a.folded.documents.filter((d) => d.docType === "msa_comments").map((d) => `The supplier's comments on the MSA (${d.name})`),
    ...(a.checklist.some((c) => c.key === "dpa") ? ["DPA terms (assigned to Legal review)"] : []),
    "Whether the scope and rates are good value",
  ];
  const exc = a.req.exceptions.filter((e) => ap.key === "vp" ? e.kind !== "retro" : ap.key === "budget_owner" ? e.kind === "retro" : false);
  return (
    <div role="dialog" aria-modal="true" aria-label="Decision Receipt" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
          <div><div className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Decision Receipt · {a.req.id}</div><div className="text-[16px] font-semibold">{KEY_LABEL[ap.key]}: {personName(ap.approverId)}</div></div>
          <div className="flex items-center gap-2"><StateChip state={ap.status} /><Button small variant="ghost" onClick={onClose}>Close</Button></div>
        </div>
        <div className="space-y-4 px-5 py-4 text-[13px]">
          {(() => { const v = useAva.getState().state.ai.recs[`receipt:${a.req.id}:${ap.key}`]; return v?.output.bullets ? (
            <section className="rounded-lg border border-violet-200 bg-violet-50/60 px-3.5 py-2.5"><h3 className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-violet-900">Ava’s summary for you <AiLabel source={v.source} /></h3><ul className="list-disc space-y-0.5 pl-5">{v.output.bullets.map((b) => <li key={b}>{b}</li>)}</ul><p className="mt-1 text-[11.5px] text-slate-500">Prepared {fmtDT(v.at)}. The decision is yours; Ava never approves.</p></section>) : null; })()}
          {ap.status === "needs_reconfirmation" && <div className="rounded-md bg-red-50 px-3 py-2 text-red-800 ring-1 ring-red-200"><b>Needs reconfirmation.</b> {ap.diffs.map((d) => `Given for ${d.old}. Current: ${d.new}.`).join(" ")}{ap.reopenSource && ` Source: ${ap.reopenSource}.`}</div>}
          <section><h3 className="mb-1.5 font-semibold">You are approving</h3>
            <table className="w-full tabular"><tbody>
              {ap.key !== "infosec" && <tr><td className="py-0.5 text-slate-500">Amount (before GST)</td><td className="text-right font-medium">{inr(a.amount)}{a.retro ? ` + ${inr(a.retro)} already invoiced = ${inr(a.requestAmount)}` : ""}</td></tr>}
              <tr><td className="py-0.5 text-slate-500">Scope</td><td className="text-right">{a.facts.scope?.value ?? a.req.project}</td></tr>
              {a.facts.duration && <tr><td className="py-0.5 text-slate-500">Term</td><td className="text-right">{a.facts.duration.value}</td></tr>}
              <tr><td className="py-0.5 text-slate-500">90-day total ({a.req.costCentre})</td><td className="text-right font-medium">{inr(a.spend.total)} <span className="text-slate-500">({a.spend.text})</span></td></tr>
              {ap.key === "infosec" && <tr><td className="py-0.5 text-slate-500">Data access</td><td className="text-right">{a.facts.data_access?.value}</td></tr>}
              {quoteDocs.length > 0 && <tr><td className="py-0.5 text-slate-500">Versions</td><td className="text-right">{quoteDocs.map((d) => `${d.name}${d.supersededBy ? " (superseded)" : " (current)"}`).join(", ")}</td></tr>}
              {exc.map((e) => <tr key={e.id}><td className="py-0.5 text-slate-500">Exception</td><td className="text-right">“{e.reason}” ({personName(e.by)})</td></tr>)}
            </tbody></table>
          </section>
          <section><h3 className="mb-1.5 font-semibold">Ava already checked</h3>
            <ul className="space-y-1">
              {docFacts.map((f) => <li key={f.field} className="flex flex-wrap gap-2"><span className="text-emerald-700">✓</span>{f.label}: {f.field === "amount" ? inr(f.num) : f.value} <SourceLink src={f.sources[0]} /></li>)}
              {checked.map((c) => <li key={c.key} className="flex gap-2"><span className="text-emerald-700">✓</span><span>{c.label}: {c.how}</span></li>)}
            </ul>
          </section>
          <section><h3 className="mb-1.5 font-semibold">Nobody has checked yet</h3>
            <ul className="list-disc space-y-1 pl-5 text-slate-700">{notChecked.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
          {ap.receipts.length > 0 && <section><h3 className="mb-1.5 font-semibold">Receipt history</h3>
            <ol className="space-y-1 text-[12.5px]">{ap.receipts.map((r) => <li key={r.id}>{fmtDT(r.at)}: {r.kind} by {personName(r.by)} for {r.snapshot.amount != null ? inr(r.snapshot.amount) : r.snapshot.total90 != null ? `${inr(r.snapshot.total90)} (90-day total)` : "data access"}{r.snapshot.retro ? ` + ${inr(r.snapshot.retro)} retrospective` : ""}{r.snapshot.exceptionIds?.length ? " and the exception" : ""}</li>)}</ol>
          </section>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {!canAct && <span className="mr-auto text-[12.5px] text-slate-500">Only {personName(ap.approverId)} can sign this. <button className="text-accent underline" onClick={() => setViewAs(ap.approverId)}>View as {firstName(ap.approverId)}</button></span>}
          {canAct && ap.status === "pending" && !ap.gateOpen && <span className="mr-auto text-[12.5px] text-amber-700">Ava has not sent this yet: the amount is not confirmed or a question is open. You can still approve.</span>}
          {canAct && (ap.status === "pending" || ap.status === "needs_reconfirmation") && <Button variant="primary" onClick={() => { act({ type: "approve", requestId: a.req.id, key: ap.key }); onClose(); }}>{ap.status === "pending" ? "Approve" : "Reconfirm at current facts"}</Button>}
          {(ap.status === "approved" || ap.status === "reconfirmed") && <span className="text-[12.5px] text-emerald-700">Signed against current facts.</span>}
        </div>
      </div>
    </div>
  );
}

export function DocumentsPanel({ a, state }: { a: Analysis; state: State }) {
  const att = (id: string) => state.emails.flatMap((e) => e.attachments).find((x) => x.id === id);
  const families = ["quote", "order_form"] as const;
  const seed = contractsFor(a.req.supplierId);
  return (
    <Card id="documents">
      <CardHead title="Documents" sub="Every file received on this request, plus existing agreements. Newer versions supersede older ones; old versions are kept." />
      <div className="flex flex-col gap-4 p-4">
        <ul className="order-last divide-y divide-slate-100 rounded-md border border-slate-200 text-[13px]">
          {a.folded.documents.map((d) => (
            <li key={d.attachmentId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <SourceLink src={{ emailId: d.emailId, attachmentId: d.attachmentId, file: d.name, quote: "" }} label={d.name} />
              <Chip>{d.docType.replace("_", " ")}</Chip>{d.version > 1 && <Chip tone="blue">v{d.version}</Chip>}{d.supersededBy && <Chip>Superseded</Chip>}
              {d.expiry && <span className="text-[12px] text-slate-500">valid until {fmtDate(d.expiry)}</span>}
              <span className="ml-auto text-[12px] text-slate-500">{fmtShort(d.receivedAt)}</span>
            </li>
          ))}
          {seed.filter((c) => c.type !== "SOW").map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-slate-600">
              {c.file ? <a className="font-medium text-accent underline" href={`/samples/${c.file}`} target="_blank" rel="noreferrer">{c.file}</a> : <span className="font-medium">{c.title}</span>}
              <Chip>{c.type === "TaxRecord" ? "GST/PAN" : c.type === "SecurityCert" ? "security cert" : c.type}</Chip><span className="text-[12px]">on file since {fmtDate(c.date)}{c.expiry ? `, expires ${fmtDate(c.expiry)}` : ""}</span>
            </li>
          ))}
        </ul>
        {families.map((fam) => {
          const docs = a.folded.documents.filter((d) => d.docType === fam);
          if (docs.length < 2) return null;
          const [o, n] = [att(docs[docs.length - 2].attachmentId), att(docs[docs.length - 1].attachmentId)];
          if (!o || !n) return null;
          const diff = docDiff(o, n); const added = new Set(diff.added); const removed = new Set(diff.removed);
          const closedHere = Object.values(state.conflicts).filter((c) => c.requestId === a.req.id && c.status === "resolved" && c.resolvedAt === docs[docs.length - 1].receivedAt);
          return (
            <div key={fam}>
              {closedHere.map((c) => <p key={c.id} className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13.5px] font-semibold text-emerald-900"><span aria-hidden>✓</span>{c.type === "renewal_terms_changed" ? "Renewal conflict closed" : "Conflict closed"}: {c.resolution?.text}</p>)}
              <div className="mb-2 text-[13px] font-semibold">Side by side: {o.name} → {n.name}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {[{ x: o, set: removed, tone: "bg-red-50 text-red-900", tag: "Removed or changed" }, { x: n, set: added, tone: "bg-amber-100 text-amber-950 font-medium", tag: "New or changed" }].map(({ x, set, tone, tag }) => (
                  <div key={x.id} className="rounded-md border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-[12px] font-medium"><span>{x.name}</span><span className="text-slate-500">{tag} highlighted</span></div>
                    <ol className="px-3 py-2 font-mono text-[11.5px] leading-relaxed">{x.pages.flat().slice(0, -1).map((l, i) => <li key={i} className={cx("rounded px-1", set.has(l) && tone)}>{l.replace(/\s+/g, " ")}</li>)}</ol>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function TimelineView({ a }: { a: Analysis }) {
  const items = [...a.req.timeline].sort((x, y) => x.at.localeCompare(y.at));
  return (
    <Card id="timeline">
      <CardHead title="Timeline" sub="Every event, with its timestamp." />
      <ol className="max-h-[520px] space-y-2 overflow-auto px-4 py-3 text-[13px]">
        {items.map((t, i) => <li key={i} className="flex gap-3"><span className="w-24 shrink-0 text-[12px] text-slate-500 tabular">{fmtShort(t.at)}</span><span className={cx(t.kind === "approval" && /reopened/.test(t.text) && "text-red-700", t.kind === "handoff" && "font-semibold text-emerald-700")}>{t.text}</span></li>)}
      </ol>
    </Card>
  );
}

export function DraftBox({ d }: { d: Draft }) {
  const act = useAva((s) => s.act); const viewAs = useAva((s) => s.viewAs);
  const byAva = useAva((s) => s.state.emails.some((e) => e.id === `out-auto-${d.id}`));
  const [copied, setCopied] = useState(false);
  const text = `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`;
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-[12px]"><span className="font-medium">{byAva ? `Ava sent this for ${personName(d.forPersonId)}: a routine message, switched on in Settings.` : `Ava's draft for ${personName(d.forPersonId)}. Ava does not send it.`}</span>{d.status === "sent" ? <Chip tone="green">Sent {d.sentAt ? fmtShort(d.sentAt) : ""}</Chip> : <Chip tone="amber">Draft</Chip>}</div>
      <div className="px-3 py-2 text-[12.5px]"><div className="text-slate-500">To: {d.to}</div><div className="text-slate-500">Subject: {d.subject}</div><p className="mt-2 whitespace-pre-wrap text-slate-800">{d.body}</p></div>
      {d.status === "draft" && <div className="flex gap-2 border-t border-slate-100 px-3 py-2">
        <Button small onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }}>{copied ? "Copied" : "Copy"}</Button>
        <Button small variant="primary" onClick={() => act({ type: "mark_sent", draftId: d.id }, viewAs === d.forPersonId ? viewAs : d.forPersonId)}>Mark as sent</Button>
      </div>}
    </div>
  );
}

export function HandoffPacket({ a, state }: { a: Analysis; state: State }) {
  const msa = contractsFor(a.req.supplierId).find((c) => c.type === "MSA");
  const packet = {
    request: { id: a.req.id, title: a.req.title, supplier: state.suppliers.find((s) => s.id === a.req.supplierId)?.name ?? a.req.supplierGuess?.name, project: a.req.project, requester: personName(a.req.requesterId), costCentre: a.req.costCentre, state: a.handoff.state, readyAt: a.req.readyAt },
    confirmedFacts: Object.values(a.facts).filter((f) => f.displayState === "confirmed").map((f) => ({ field: f.label, value: f.field === "amount" ? inr(f.num) : f.value, sources: f.sources.map((s) => ({ file: s.file, page: s.page, quote: s.quote })) })),
    documents: a.folded.documents.map((d) => ({ name: d.name, type: d.docType, version: d.version, superseded: !!d.supersededBy })),
    signedReceipts: a.approvals.flatMap((ap) => ap.receipts.map((r) => ({ approval: KEY_LABEL[ap.key], by: personName(r.by), at: r.at, kind: r.kind, snapshot: r.snapshot }))),
    exceptions: a.req.exceptions.map((e) => ({ kind: e.kind, reason: e.reason, by: personName(e.by), at: e.at })),
    assignedToLegalReview: a.checklist.filter((c) => c.status === "legal_review").map((c) => c.label),
    avaFinalRead: currentRead(state, a.req.id).v.output.sentences.map((x) => x.text).join(" "),
    contractIssuesRaisedAtIntake: (a.req.contractIssues ?? []).map((i) => ({ issue: i.title, note: i.note, by: personName(i.by), at: i.at })),
    resolvedContractIssues: Object.values(state.conflicts).filter((c) => c.requestId === a.req.id && c.type === "against_contract" && c.status === "resolved" && c.resolution?.by === "ava").map((c) => ({ issue: c.title, resolution: c.resolution!.text })),
    avaActions: actionsOf(a.req).ava.length, peopleDecisions: actionsOf(a.req).people.length,
    openNotes: [msa?.autoRenew ? "Nobody has reviewed the auto-renewal clause in the MSA." : "Nobody has reviewed clause wording.", ...a.folded.documents.filter((d) => d.docType === "msa_comments").map((d) => `Supplier comments on the MSA not reviewed (${d.name}).`)],
    proposedTerms: { label: "Proposed", price: a.amount != null ? inr(a.amount) : null, paymentTerms: a.facts.payment_terms?.value, validity: a.facts.validity?.value, duration: a.facts.duration?.value },
    existingAgreement: msa ? { id: msa.id, signed: msa.date, renewalAndNotice: msa.renewalTerms ?? null } : null,
  };
  const download = () => { const b = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = `${a.req.id}-handoff-packet.json`; l.click(); URL.revokeObjectURL(u); };
  return (
    <Card id="packet">
      <CardHead title={a.handoff.state === "ready_legal" ? "Handoff packet: Ready for Legal Review" : "Handoff packet: Ready to issue PO"} right={<Button small onClick={download}>Download packet (JSON)</Button>} sub={`Generated ${a.req.readyAt ? fmtDT(a.req.readyAt) : ""}. Prices and service terms from the supplier are marked Proposed.`} />
      <div className="grid gap-4 p-4 text-[13px] md:grid-cols-2">
        <div className="rounded-lg bg-accent-50/60 px-3 py-2 md:col-span-2"><h3 className="mb-1 font-semibold">Ava’s final read</h3><p>{packet.avaFinalRead}</p><p className="mt-1 text-[12px] text-slate-600">Ava did {packet.avaActions} actions; people made {packet.peopleDecisions} decisions.</p></div>
        {packet.contractIssuesRaisedAtIntake.length > 0 && <div className="md:col-span-2"><h3 className="mb-1 font-semibold">Contract issues raised at intake</h3><ul className="list-disc pl-5">{packet.contractIssuesRaisedAtIntake.map((i) => <li key={i.issue}><b>{i.issue}.</b> {i.note} ({i.by})</li>)}</ul></div>}
        {packet.resolvedContractIssues.length > 0 && <div className="md:col-span-2"><h3 className="mb-1 font-semibold">Contract issues resolved during intake</h3><ul className="list-disc pl-5">{packet.resolvedContractIssues.map((i) => <li key={i.issue}><b>{i.issue}.</b> {i.resolution}</li>)}</ul></div>}
        <div><h3 className="mb-1 font-semibold">Confirmed facts</h3><ul className="space-y-0.5">{packet.confirmedFacts.map((f) => <li key={f.field}><span className="text-slate-500">{f.field}:</span> {f.value}</li>)}</ul></div>
        <div><h3 className="mb-1 font-semibold">Proposed terms <Chip tone="amber">Proposed</Chip></h3><ul className="space-y-0.5"><li>Price: {packet.proposedTerms.price}</li>{packet.proposedTerms.paymentTerms && <li>Payment terms: {packet.proposedTerms.paymentTerms}</li>}{packet.proposedTerms.validity && <li>Quote validity: {packet.proposedTerms.validity}</li>}{packet.proposedTerms.duration && <li>Duration: {packet.proposedTerms.duration}</li>}</ul>
          {packet.existingAgreement && <><h3 className="mb-1 mt-3 font-semibold">Existing agreement</h3><p>{packet.existingAgreement.id}, signed {fmtDate(packet.existingAgreement.signed)}. {packet.existingAgreement.renewalAndNotice}</p></>}</div>
        <div><h3 className="mb-1 font-semibold">Signed receipts</h3><ul className="space-y-0.5">{packet.signedReceipts.map((r, i) => <li key={i}>{r.approval}: {r.kind} by {r.by}, {fmtDT(r.at)}</li>)}</ul></div>
        <div><h3 className="mb-1 font-semibold">Exceptions</h3>{packet.exceptions.length ? <ul>{packet.exceptions.map((e, i) => <li key={i}>“{e.reason}” ({e.by})</li>)}</ul> : <p className="text-slate-500">None</p>}
          <h3 className="mb-1 mt-3 font-semibold">Assigned to Legal review</h3>{packet.assignedToLegalReview.length ? <ul>{packet.assignedToLegalReview.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-slate-500">None</p>}
          <h3 className="mb-1 mt-3 font-semibold">Open notes</h3><ul className="list-disc pl-5">{packet.openNotes.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="md:col-span-2"><h3 className="mb-1 font-semibold">Documents</h3><p>{packet.documents.map((d) => `${d.name}${d.superseded ? " (superseded)" : ""}`).join(", ")}</p></div>
      </div>
    </Card>
  );
}

export function SrcQuote(p: Parameters<typeof Quote>[0]) { return <Quote {...p} />; }
