"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Term } from "@/components/guide/Term";
import Link from "next/link";
import type { Attachment, Email, Source, State } from "@/lib/types";
import { useAva } from "@/lib/store";
import { displayAddr, PEOPLE, personByEmail, personName } from "@/lib/engine/world";
import { labelSource } from "@/lib/engine/pipeline";
import { analyze } from "@/lib/engine/rules";
import { deriveItems } from "@/lib/engine/items";
import { addMinutes, fmtDT, fmtShort, inr, lakh, parseAmount, parseMonths, uid } from "@/lib/format";
import { FIELD_LABEL, mapField } from "@/lib/engine/facts";
import { Icon } from "@/components/icons";
import { sampleAttachment, SAMPLE_GROUPS } from "@/lib/samples";
import { extractForEmail, uploadForText } from "@/lib/extractClient";
import { Button, Card, CardHead, Chip, cx, Empty, PageTitle, SourceLink, StateChip, supplierShort } from "@/components/ui";
import { AvaRead, EmailChecks, useLiveAi } from "@/components/ai";

export default function MailPage() { return <Suspense><Mail /></Suspense>; }

const FILTERS = [["all", "All"], ["rahul", "Rahul"], ["neha", "Neha"], ["suresh", "Suresh"]] as const;

function Mail() {
  const state = useAva((s) => s.state);
  const sp = useSearchParams(); const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [composing, setComposing] = useState(sp.get("compose") === "1");
  const [outlook, setOutlook] = useState(false);
  const selected = sp.get("email");
  useEffect(() => { if (sp.get("compose") === "1") setComposing(true); }, [sp]);
  const emails = useMemo(() => [...state.emails].filter((e) => filter === "all" || [e.from, ...e.to, ...e.cc].some((a) => personByEmail(a)?.id === filter)).sort((a, b) => b.sentAt.localeCompare(a.sentAt)), [state.emails, filter]);
  const email = state.emails.find((e) => e.id === selected) ?? (composing ? undefined : emails[0]);
  return (
    <div>
      <PageTitle title="Captured mail" sub={<>Supplier email Ava received through the <Term id="mail-rule">mail rule</Term>. Simulated here.</>} right={<Button onClick={() => setComposing(true)}>Test lab: simulate an incoming email</Button>} />
      <div className="grid grid-cols-1 gap-4 break-words lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Card>
          <div role="tablist" aria-label="Mailbox filter" className="flex gap-1 border-b border-slate-100 p-2">
            {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cx("rounded-md px-2.5 py-1 text-[12.5px]", filter === k ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100")}>{l}</button>)}
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-auto">
            {emails.map((e) => (
              <li key={e.id}><button onClick={() => { setComposing(false); router.replace(`/mail?email=${e.id}`); }} className={cx("block w-full px-3 py-2.5 text-left hover:bg-slate-50", email?.id === e.id && !composing && "bg-accent-50")}>
                <div className="flex justify-between gap-2 text-[12.5px]"><span className="truncate font-semibold">{displayAddr(e.from, state)}</span><span className="shrink-0 text-slate-500">{fmtShort(e.sentAt)}</span></div>
                <div className="truncate text-[12px] text-slate-500">to {e.to.map((t) => displayAddr(t, state)).join(", ")}</div>
                <div className="truncate text-[13px]">{e.subject}</div>
                <div className="mt-1 flex flex-wrap gap-1">{e.attachments.map((a) => <Chip key={a.id}>{a.name}</Chip>)}{e.origin === "ava_draft" && <Chip tone="blue">Sent from Ava's draft</Chip>}{e.origin === "composed" && <Chip tone="blue">Composed</Chip>}</div>
              </button></li>
            ))}
            {!emails.length && <li className="p-4"><Empty>No email yet. Press Start in the story bar, or open the test lab.</Empty></li>}
          </ul>
        </Card>
        {composing ? <Composer onDone={(id) => { setComposing(false); router.replace(`/mail?email=${id}`); }} onCancel={() => setComposing(false)} /> : email ? (
          <div className="min-w-0 space-y-2">
            {employeeOf(email) && <div className="flex flex-wrap items-center justify-between gap-2"><button onClick={() => setOutlook(!outlook)} aria-pressed={outlook} className={cx("flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] font-medium", outlook ? "border-accent bg-accent-50 text-accent-700" : "border-slate-300 bg-white hover:bg-slate-50")}><Icon name="mail" size={15} />{outlook ? "Back to Ava's view" : `See it as ${personName(employeeOf(email)).split(" ")[0]} does in Outlook`}</button>{outlook && <span className="text-[12px] text-slate-500">Optional add-in, for reading; capture happens centrally.</span>}</div>}
            {outlook && employeeOf(email) ? <OutlookView email={email} personId={employeeOf(email)!} /> : <EmailView email={email} />}
          </div>) : <Empty>Select an email.</Empty>}
        {!composing && email ? <AvaRecorded email={email} /> : <TryThis />}
      </div>
    </div>
  );
}

function EmailView({ email }: { email: Email }) {
  const state = useAva((s) => s.state); const open = useAva((s) => s.openSource);
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[16px] font-semibold">{email.subject}</h2>
        <div className="mt-1 text-[12.5px] text-slate-600">From <b>{displayAddr(email.from, state)}</b> &lt;{email.from}&gt;</div>
        <div className="text-[12.5px] text-slate-600">To {email.to.map((t) => `${displayAddr(t, state)} <${t}>`).join(", ")}{email.cc.length > 0 && `; Cc ${email.cc.join(", ")}`}</div>
        <div className="text-[12.5px] text-slate-500">{fmtDT(email.sentAt)}</div>
      </div>
      <div className="whitespace-pre-wrap px-5 py-4 text-[14px] leading-relaxed">{email.body}</div>
      {email.attachments.length > 0 && <div className="border-t border-slate-100 px-5 py-3">
        <div className="mb-2 text-[12px] font-semibold text-slate-500">Attachments</div>
        <div className="flex flex-wrap gap-2">{email.attachments.map((a) => (
          <button key={a.id} onClick={() => open({ emailId: email.id, attachmentId: a.id })} className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-left text-[13px] hover:bg-slate-50">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-600">{a.kind}</span>
            <span><span className="block font-medium">{a.name}</span><span className="text-[11.5px] text-slate-500">{a.pages.length} {a.kind === "xlsx" ? "sheet(s)" : "page(s)"} · open viewer</span></span>
          </button>
        ))}</div>
      </div>}
    </Card>
  );
}

function changeBanner(state: State, email: Email, reqId?: string) {
  if (!reqId) return null;
  const a = analyze(state, reqId);
  const opened = Object.values(state.conflicts).filter((c) => c.requestId === reqId && c.openedAt === email.sentAt);
  const closed = Object.values(state.conflicts).filter((c) => c.requestId === reqId && c.resolvedAt === email.sentAt);
  const bodyHasPrice = /₹|\brs\b|\binr\b|lakh|\d+\s?l\b/i.test(email.body);
  const prevDoc = (attId?: string) => { const docs = a.folded.documents.filter((d) => ["quote", "order_form", "sow"].includes(d.docType)); const k = docs.findIndex((d) => d.attachmentId === attId); return k > 0 ? docs[k - 1].attachmentId : undefined; };
  for (const c of opened) {
    const att = c.b.quotes[0]?.attachmentId;
    const line = c.b.quotes.find((q) => q.note === "New line")?.quote ?? c.b.quotes[0]?.quote;
    const pdf = att ? { emailId: email.id, attachmentId: att, quote: c.type === "renewal_terms_changed" ? undefined : line, quotes: c.type === "renewal_terms_changed" ? c.b.quotes.map((q) => q.quote) : undefined, compareWith: c.type === "said_vs_written" ? prevDoc(att) : undefined, title: c.type === "said_vs_written" ? "What changed in the quote" : "What the order form says" } : undefined;
    if (c.type === "said_vs_written" && c.field === "amount") {
      const diff = (parseAmount(c.bValue) ?? 0) - (parseAmount(c.aValue) ?? 0);
      return { tone: "amber" as const, text: `Price changed in the attachment: ${c.aValue} → ${c.bValue} (${diff >= 0 ? "+" : "−"}${inr(Math.abs(diff))}).${bodyHasPrice ? "" : " The email body says nothing about price."}`, pdf, conflict: c.id };
    }
    if (c.type === "renewal_terms_changed") {
      const claim = c.a.quotes[0]?.quote.replace(/\.$/, "") ?? "nothing changes";
      const bits = c.b.quotes.map((q) => { if (/renews automatically|auto-?renew/i.test(q.quote)) return "auto-renewal"; const months = parseMonths(q.quote); if (/^term|months/i.test(q.quote) && months) return `${months} months`; const amt = /₹/.test(q.quote) ? parseAmount(q.quote) : undefined; if (amt) return `${inr(amt)} (${q.note?.replace(/ above /, " on ").replace(/^(\d+)%/, "+$1%") ?? ""})`; return q.quote; });
      return { tone: "amber" as const, text: `The email says “${claim}”. The order form says ${bits.join(", ")}.`, pdf, conflict: c.id };
    }
    if (c.type === "hidden_scope") return { tone: "amber" as const, text: `${c.title} Rahul is asked to confirm.`.replace("Rahul", personName(state.requests[reqId].requesterId).split(" ")[0]), pdf: c.b.quotes[0]?.attachmentId ? { emailId: email.id, attachmentId: c.b.quotes[0].attachmentId, quote: c.b.quotes[0].quote } : undefined, conflict: c.id };
    if (c.type === "started_before_approval") return { tone: "amber" as const, text: `${c.title}. It arrived before any approval.`, pdf: c.b.quotes[0]?.attachmentId ? { emailId: email.id, attachmentId: c.b.quotes[0].attachmentId, quote: c.b.quotes[0].quote } : undefined, conflict: c.id };
  }
  for (const c of closed) {
    const att = email.attachments[0]?.id;
    return { tone: "green" as const, text: `${c.type === "renewal_terms_changed" ? "Renewal conflict closed" : "Conflict closed"}: ${c.resolution?.text ?? "the sources now agree"}`, pdf: att ? { emailId: email.id, attachmentId: att, compareWith: prevDoc(att), title: "Before and after" } : undefined, conflict: c.id };
  }
  const ch = state.changes.filter((c) => c.requestId === reqId && c.at === email.sentAt)[0];
  if (ch) return { tone: "amber" as const, text: `${ch.field} changed: ${ch.old} → ${ch.new}.`, pdf: ch.source.attachmentId ? { emailId: email.id, attachmentId: ch.source.attachmentId, quote: ch.source.quote } : undefined, conflict: undefined };
  return null;
}

function AvaRecorded({ email }: { email: Email }) {
  const state = useAva((s) => s.state); const open = useAva((s) => s.openSource);
  const ex = state.extractions[email.id];
  const reqId = Object.values(state.requests).find((r) => r.emailIds.includes(email.id))?.id;
  const req = reqId ? state.requests[reqId] : undefined;
  const orphan = state.orphans.find((o) => o.emailId === email.id);
  const sup = state.suppliers.find((s) => s.id === req?.supplierId);
  const flags = req ? req.flags.filter((f) => f.createdAt === email.sentAt && f.type !== "mention") : [];
  const conflicts = Object.values(state.conflicts).filter((c) => c.requestId === reqId && c.openedAt === email.sentAt);
  const a = reqId ? analyze(state, reqId) : undefined;
  const banner = changeBanner(state, email, reqId);
  useLiveAi(reqId ?? "");
  // One row per request field, showing the request-level state (not the per-email state).
  const rows: { key: string; label: string; value: string; src: Source; state: string; by?: string }[] = [];
  for (const f of ex?.result?.facts ?? []) {
    const field = mapField(f) ?? f.field;
    const att = email.attachments.find((x) => x.name.toLowerCase() === f.source.file.toLowerCase());
    const src: Source = { emailId: email.id, file: f.source.file, attachmentId: att?.id, page: f.source.page, quote: f.source.quote };
    const existing = rows.find((r) => r.key === field);
    if (existing) { if (f.source.file !== "email" && existing.src.file === "email") { existing.value = f.value; existing.src = src; } continue; }
    const rf = a?.facts[field];
    let st = rf?.displayState ?? f.state; let by: string | undefined;
    if (rf?.confirmedBy) by = `Confirmed by ${personName(rf.confirmedBy)}, ${fmtDT(rf.versions[rf.versions.length - 1].at)}`;
    else if (rf && rf.origin === "document" && rf.displayState === "confirmed") by = "Confirmed by a document";
    if (!rf) st = f.state;
    rows.push({ key: field, label: FIELD_LABEL[field] ?? f.field.replace(/_/g, " "), value: f.value, src, state: st, by });
  }
  const who = (role: string) => role === "requester" ? personName(req?.requesterId) : ({ procurement: "Karan Shah", infosec: "Meera Nair", legal: "Farah Khan", finance: "Suresh Pillai", vp: "Vikram Rao", budget_owner: "the budget owner" } as Record<string, string>)[role] ?? role;
  return (
    <Card className="self-start" >
      <div data-pulse="ava-recorded">
      <CardHead title="Ava recorded" right={ex && ex.source !== "none" ? <Chip tone={ex.source === "basic" ? "amber" : "blue"}>{labelSource(ex.source)}</Chip> : undefined} />
      <div className="space-y-4 px-4 py-3 text-[13px]">
        {reqId && email.origin !== "ava_draft" && <div data-pulse="ava-read" className="rounded-lg bg-accent-50/70 px-3 py-2"><AvaRead reqId={reqId} compact /></div>}
        {email.origin === "ava_draft" && <p>Ava&apos;s draft, sent by {personByEmail(email.from)?.name}. Recorded in the thread. No facts are taken from our own questions.</p>}
        {banner && (
          <div data-pulse="change-banner" className={cx("rounded-lg border px-3 py-2.5", banner.tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-300 bg-emerald-50 text-emerald-950")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em]">{banner.tone === "amber" ? "What changed" : "Resolved"}</p>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug">{banner.text}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {banner.pdf && <button onClick={() => open(banner.pdf as any)} className="rounded-md border border-current/20 bg-white px-2 py-1 text-[12.5px] font-medium">{banner.tone === "green" ? "Compare the versions" : "See the line in the PDF"}</button>}
              {banner.conflict && reqId && <Link href={`/requests/${reqId}#conflicts`} className="rounded-md border border-current/20 bg-white px-2 py-1 text-[12.5px] font-medium">Open the conflict</Link>}
            </div>
          </div>
        )}
        {a && a.checks.some((k) => k.emailId === email.id) && <div><div className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-500">Checked against the contracts</div><EmailChecks a={a} emailId={email.id} /></div>}
        {orphan && <div data-pulse="change-banner" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-[0.05em]">Invoice with no request</p><p className="mt-0.5 font-semibold">{orphan.invoiceNo}, {lakh(orphan.amount)} before GST. No request, contract or PO behind it.</p><p className="text-[12.5px]">{orphan.likelyOwnerId ? `Asked ${personName(orphan.likelyOwnerId)} to confirm (named as "Attention" on the invoice).` : "Sent to Procurement's Unsorted tray."}</p></div>}
        {(conflicts.length > 0 || flags.length > 0) && <div><div className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-500">Needs attention</div>
          <ul className="space-y-1">
            {conflicts.map((c) => <li key={c.id} className="flex gap-2"><Icon name="alert" className="mt-0.5 shrink-0 text-red-600" size={14} /><span><Link className="font-medium text-slate-900 hover:underline" href={`/requests/${c.requestId}#conflicts`}>{c.title}</Link> <span className="text-slate-500">→ {personName(c.ownerId)}</span></span></li>)}
            {flags.map((f) => <li key={f.id} className="flex gap-2"><Icon name={f.question ? "users" : "bell"} className="mt-0.5 shrink-0 text-amber-600" size={14} /><span>{f.message} <span className="text-slate-500">→ {who(f.sendTo)}</span></span></li>)}
          </ul></div>}
        {req && <div><div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-500">Filed under</div>
          <div className="mt-1 font-medium">{sup ? <Link className="hover:underline" href={`/suppliers/${sup.id}`}>{supplierShort(sup.name)}</Link> : `Possible new supplier: ${req.supplierGuess?.name}`} › {req.project} › <Link className="whitespace-nowrap text-accent hover:underline" href={`/requests/${req.id}`}>{req.id}</Link></div>
          <div className="mt-0.5 text-[12.5px] text-slate-600">Filing confidence: <b>{req.filing.confidence}</b>{a && <> · now <StateChip state={a.handoff.state} /></>}</div></div>}
        {!req && !orphan && email.origin !== "ava_draft" && <p className="text-slate-600">Not filed: no supplier domain or commercial content in this email.</p>}
        {rows.length > 0 && <details className="rounded-lg border border-slate-200">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium">Facts: {rows.length} extracted <span className="font-normal text-slate-500">· show</span></summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">{rows.map((r) => (
            <li key={r.key} className="px-3 py-2"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[12px] text-slate-500">{r.label}</span><StateChip state={r.state} /></div>
              <div className="font-medium">{r.value}</div>{r.by && <div className="text-[12px] text-slate-500">{r.by}</div>}<SourceLink src={r.src} label={`Source: ${r.src.file === "email" ? "email" : `${r.src.file}${r.src.page ? `, p.${r.src.page}` : ""}`}`} /></li>))}
          </ul>
        </details>}
      </div>
      </div>
    </Card>
  );
}

// ----- Compose -----
interface Draft { from: string; to: string; cc: string; subject: string; body: string; threadId: string; files: Attachment[] }
const blank: Draft = { from: "rahul.mehta@prayaan.example", to: "", cc: "", subject: "", body: "", threadId: "", files: [] };
let pending: Partial<Draft> | null = null;
export function prefill(d: Partial<Draft>) { pending = d; window.dispatchEvent(new Event("ava-prefill")); }

function Composer({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const state = useAva((s) => s.state); const addEmail = useAva((s) => s.addEmail);
  const [d, setD] = useState<Draft>(() => ({ ...blank, ...(pending ?? {}) }));
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { pending = null; const h = () => { if (pending) { setD({ ...blank, ...pending }); pending = null; } }; window.addEventListener("ava-prefill", h); return () => window.removeEventListener("ava-prefill", h); }, []);
  const threads = useMemo(() => { const m = new Map<string, Email>(); state.emails.forEach((e) => { if (!m.has(e.threadId)) m.set(e.threadId, e); }); return [...m.values()]; }, [state.emails]);
  const senders = [...PEOPLE.map((p) => ({ v: p.email, l: `${p.name} (Prayaan)` })), ...state.suppliers.flatMap((s) => s.contacts.map((c) => ({ v: c.email, l: `${c.name} (${s.name})` })))];
  const set = (k: keyof Draft, v: any) => setD((x) => ({ ...x, [k]: v }));
  const pickThread = (tid: string) => {
    const t = state.emails.filter((e) => e.threadId === tid).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    if (!t.length) return set("threadId", "");
    const last = t[t.length - 1];
    setD((x) => ({ ...x, threadId: tid, subject: x.subject || `RE: ${t[0].subject.replace(/^re:\s*/i, "")}`, to: x.to || (last.from === x.from ? last.to[0] : last.from) }));
  };
  const upload = async (files: FileList | null) => {
    if (!files) return; setErr(null);
    for (const f of Array.from(files)) {
      setBusy(`Reading ${f.name} on the server…`);
      try {
        const t = await uploadForText(f);
        const url = f.size < 900_000 ? await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(f); }) : undefined;
        setD((x) => ({ ...x, files: [...x.files, { id: uid("up"), name: f.name, url, kind: t.kind, pages: t.pages, sheets: t.sheets }] }));
      } catch (e: any) { setErr(e.message); }
    }
    setBusy(null);
  };
  const send = async () => {
    setErr(null);
    if (!d.from || !d.to || !d.subject) { setErr("From, To and Subject are required."); return; }
    const id = uid("m");
    const email: Email = { id, threadId: d.threadId || `t-${id}`, from: d.from.trim().toLowerCase(), to: d.to.split(/[,;]\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean), cc: d.cc.split(/[,;]\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean), subject: d.subject, body: d.body, sentAt: addMinutes(state.now, 1), attachments: d.files.map((f, i) => ({ ...f, id: `${id}-att${i + 1}` })), origin: "composed" };
    setBusy("Ava is reading the email and attachments…");
    const r = await extractForEmail(email, state);
    addEmail(email, r.result, r.source);
    setBusy(null); onDone(id);
  };
  return (
    <Card>
      <CardHead title="Test lab: simulate an incoming email" sub="In real use, these emails come from Outlook or Gmail through a mail rule. Here you can write any email, as anyone. It runs through the same pipeline as the scripted emails." right={<Button small variant="ghost" onClick={onCancel}>Cancel</Button>} />
      <div className="space-y-2.5 px-5 py-4 text-[13px]">
        <label className="block">From<input list="senders" value={d.from} onChange={(e) => set("from", e.target.value)} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1.5" placeholder="Any person, supplier contact, or a new external address" />
          <datalist id="senders">{senders.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</datalist></label>
        <label className="block">Reply in thread<select value={d.threadId} onChange={(e) => pickThread(e.target.value)} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1.5"><option value="">New thread</option>{threads.map((t) => <option key={t.threadId} value={t.threadId}>{t.subject} ({displayAddr(t.from, state)})</option>)}</select></label>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">To<input list="senders" value={d.to} onChange={(e) => set("to", e.target.value)} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1.5" /></label>
          <label className="block">Cc<input value={d.cc} onChange={(e) => set("cc", e.target.value)} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        </div>
        <label className="block">Subject<input value={d.subject} onChange={(e) => set("subject", e.target.value)} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <label className="block">Body<textarea value={d.body} onChange={(e) => set("body", e.target.value)} rows={6} className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1.5" /></label>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">Attachments
            <label className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-[12px] hover:bg-slate-50">Upload PDF or XLSX<input type="file" accept=".pdf,.xlsx,.xls" multiple className="sr-only" onChange={(e) => upload(e.target.files)} /></label>
            <select aria-label="Add a sample file" value="" onChange={(e) => { if (e.target.value) setD((x) => ({ ...x, files: [...x.files, sampleAttachment(e.target.value, uid("s"))] })); }} className="rounded border border-slate-300 px-2 py-1 text-[12px]">
              <option value="">Add from sample files…</option>{SAMPLE_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.files.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">{d.files.map((f) => <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px]">{f.name}<button aria-label={`Remove ${f.name}`} onClick={() => setD((x) => ({ ...x, files: x.files.filter((y) => y.id !== f.id) }))} className="text-slate-500 hover:text-red-600">×</button></span>)}</div>
        </div>
        {err && <p className="text-red-700">{err}</p>}
        <div className="flex items-center gap-3 pt-1"><Button variant="primary" onClick={send} disabled={!!busy}>Simulate email arriving</Button>{busy && <span className="text-slate-500">{busy}</span>}<span className="ml-auto text-[12px] text-slate-500">Arrives at {fmtShort(addMinutes(state.now, 1))} (simulated clock). In real use, these emails come from Outlook or Gmail through a mail rule.</span></div>
      </div>
    </Card>
  );
}

function TryThis() {
  const state = useAva((s) => s.state); const ai = useAva((s) => s.aiAvailable);
  const sfm = state.threadRequest["t-sfm"] ? "t-sfm" : "";
  const items: { label: string; expect: string; d: Partial<Draft> }[] = [
    { label: "As Arjun, reply with a quote for ₹23L", expect: "A said-vs-written conflict; the 90-day total updates; approvals reopen.", d: { from: "arjun.d@trivenika.example", to: "rahul.mehta@prayaan.example", threadId: sfm, subject: "RE: Salesforce migration – can you help?", body: "Hi Rahul, our revised quote is attached. Regards, Arjun", files: [sampleAttachment("Trivenika_Quote_23L.pdf", uid("s"))] } },
    { label: "As Arjun: \"Our team has started work today\"", expect: "A started-before-approval conflict.", d: { from: "arjun.d@trivenika.example", to: "rahul.mehta@prayaan.example", threadId: sfm, subject: "RE: Salesforce migration – can you help?", body: "Hi Rahul, quick update: our team has started work today on the migration. Regards, Arjun" } },
    { label: "As a new supplier, send a quote", expect: "Possible new supplier, sent to Procurement.", d: { from: "sales@navkar.example", to: "karan.shah@prayaan.example", subject: "Quotation: office relocation", body: "Dear Karan, please find our quotation for the office relocation from Pune to Bengaluru. Regards, Navkar Logistics", files: [sampleAttachment("Navkar_Logistics_Quote.pdf", uid("s"))] } },
    { label: "As Rahul, ask a supplier to renew with no changes", expect: "A new renewal request.", d: { from: "rahul.mehta@prayaan.example", to: "arjun.d@trivenika.example", subject: "Renewal: Salesforce support retainer", body: "Hi Arjun, please renew the Salesforce support retainer for Q1 2027 with no changes. Thanks, Rahul" } },
    { label: "As Arjun, send an expired ISO certificate", expect: "The security certificate check reopens for InfoSec.", d: { from: "arjun.d@trivenika.example", to: "rahul.mehta@prayaan.example", threadId: sfm, subject: "RE: Salesforce migration – can you help?", body: "Hi Rahul, attached is our ISO certificate. Regards, Arjun", files: [sampleAttachment("Trivenika_ISO27001_expired.pdf", uid("s"))] } },
  ];
  return (
    <Card className="self-start">
      <CardHead title="Try this" sub={<>Each one pre-fills the test lab. {ai ? <>Extraction: <b>Live AI</b>.</> : <>AI unavailable right now; basic extraction and summaries from rules are used.</>}</>} />
      <ul className="divide-y divide-slate-100">
        {items.map((it) => <li key={it.label} className="px-4 py-2.5"><button className="text-left text-[13px] font-medium text-accent hover:underline" onClick={() => prefill(it.d)}>{it.label}</button><div className="text-[12px] text-slate-500">Expect: {it.expect}</div></li>)}
      </ul>
      <p className="px-4 pb-3 text-[12px] text-slate-500">Tip: switch "View as" to act as each stakeholder after sending.</p>
    </Card>
  );
}

function employeeOf(email: Email): string | undefined {
  const p = personByEmail(email.from) ?? [...email.to, ...email.cc].map((a) => personByEmail(a)).find(Boolean);
  return p?.id;
}

/** The same email as the employee sees it in their mail client, with a narrow Ava add-in. */
function OutlookView({ email, personId }: { email: Email; personId: string }) {
  const { state, act } = useAva(); const open = useAva((s) => s.openSource);
  const reqId = Object.values(state.requests).find((r) => r.emailIds.includes(email.id))?.id;
  const a = reqId ? analyze(state, reqId) : undefined;
  const mine = deriveItems(state).filter((i) => i.personId === personId && (!reqId || i.requestId === reqId));
  const first = personName(personId).split(" ")[0];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center gap-3 bg-[#0f5fb8] px-3 py-2 text-white">
        <span className="text-[13px] font-semibold">Mail</span>
        <span className="hidden flex-1 rounded bg-white/20 px-2 py-1 text-[12px] text-white/80 sm:block">Search</span>
        <span className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-white/25 text-[10.5px] font-semibold">{personName(personId).split(" ").map((w) => w[0]).join("")}</span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 border-r border-slate-200 p-4">
          <h2 className="text-[17px] font-semibold">{email.subject}</h2>
          <div className="mt-1 text-[12.5px] text-slate-600">{displayAddr(email.from, state)} · {fmtDT(email.sentAt)}</div>
          <div className="text-[12.5px] text-slate-500">To: {email.to.map((t) => displayAddr(t, state)).join(", ")}</div>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{email.body}</p>
          {email.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{email.attachments.map((x) => <button key={x.id} onClick={() => open({ emailId: email.id, attachmentId: x.id })} className="rounded border border-slate-300 px-2 py-1 text-[12.5px] hover:bg-slate-50">{x.name}</button>)}</div>}
        </div>
        <aside aria-label="Ava add-in" className="bg-slate-50 p-3">
          <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded bg-accent text-[11px] font-bold text-white">A</span><span className="text-[13px] font-semibold">Ava</span></div>
          {reqId && a ? <>
            <Link href={`/requests/${reqId}`} className="mt-2 block rounded-lg border border-slate-200 bg-white p-2.5 hover:border-accent">
              <span className="font-mono text-[12px] text-slate-500">{reqId}</span>
              <span className="block text-[13px] font-semibold leading-snug">{state.requests[reqId].title}</span>
              <span className="mt-1 block"><StateChip state={a.handoff.state} /></span>
            </Link>
            <p className="mt-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-500">Waiting on {first}</p>
            {mine.length === 0 && <p className="mt-1 text-[12.5px] text-slate-600">Nothing. Ava will tell you if something changes.</p>}
            <ul className="mt-1 space-y-2">{mine.map((it) => (
              <li key={it.key} className="rounded-lg border border-slate-200 bg-white p-2.5 text-[12.5px]">
                <p className="font-medium leading-snug">{it.question}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {it.kind === "question" && it.flagId && <><button className="rounded bg-accent px-2 py-0.5 font-medium text-white" onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "yes" }, personId)}>Yes</button><button className="rounded border border-slate-300 px-2 py-0.5" onClick={() => act({ type: "answer_flag", requestId: it.requestId!, flagId: it.flagId!, answer: "no" }, personId)}>No</button></>}
                  {(it.kind === "info" || it.kind === "mention") && it.flagId && <button className="rounded border border-slate-300 px-2 py-0.5" onClick={() => act({ type: "dismiss_flag", requestId: it.requestId!, flagId: it.flagId! }, personId)}>Noted</button>}
                  {it.kind === "draft" && it.draftId && <button className="rounded bg-accent px-2 py-0.5 font-medium text-white" onClick={() => act({ type: "mark_sent", draftId: it.draftId! }, personId)}>Send draft</button>}
                  {!["question", "info", "mention", "draft"].includes(it.kind) && <Link href="/today" className="rounded border border-slate-300 px-2 py-0.5">Open in Ava</Link>}
                </div>
              </li>))}
            </ul>
          </> : <p className="mt-2 text-[12.5px] text-slate-600">Ava did not file this email.</p>}
          <p className="mt-3 text-[11px] text-slate-500">Optional add-in, for reading; capture happens centrally.</p>
        </aside>
      </div>
    </div>
  );
}
