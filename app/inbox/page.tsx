"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Attachment, Email } from "@/lib/types";
import { useAva } from "@/lib/store";
import { displayAddr, PEOPLE, personByEmail, personName } from "@/lib/engine/world";
import { labelSource } from "@/lib/engine/pipeline";
import { analyze } from "@/lib/engine/rules";
import { addMinutes, fmtDT, fmtShort, lakh, uid } from "@/lib/format";
import { sampleAttachment, SAMPLE_GROUPS } from "@/lib/samples";
import { extractForEmail, uploadForText } from "@/lib/extractClient";
import { Button, Card, CardHead, Chip, cx, Empty, PageTitle, SourceLink, StateChip } from "@/components/ui";

export default function InboxPage() { return <Suspense><Inbox /></Suspense>; }

const FILTERS = [["all", "All"], ["rahul", "Rahul"], ["neha", "Neha"], ["suresh", "Suresh"]] as const;

function Inbox() {
  const state = useAva((s) => s.state);
  const sp = useSearchParams(); const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [composing, setComposing] = useState(sp.get("compose") === "1");
  const selected = sp.get("email");
  const emails = useMemo(() => [...state.emails].filter((e) => filter === "all" || [e.from, ...e.to, ...e.cc].some((a) => personByEmail(a)?.id === filter)).sort((a, b) => b.sentAt.localeCompare(a.sentAt)), [state.emails, filter]);
  const email = state.emails.find((e) => e.id === selected) ?? (composing ? undefined : emails[0]);
  return (
    <div>
      <PageTitle title="Inbox" sub="A simulated mailbox of supplier email. Ava records every email and attachment exchanged with supplier domains. Compose any email, from anyone, to test the full pipeline." right={<Button variant="primary" onClick={() => setComposing(true)}>New email</Button>} />
      <div className="grid grid-cols-1 gap-4 break-words lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Card>
          <div role="tablist" aria-label="Mailbox filter" className="flex gap-1 border-b border-slate-100 p-2">
            {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cx("rounded-md px-2.5 py-1 text-[12.5px]", filter === k ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100")}>{l}</button>)}
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-auto">
            {emails.map((e) => (
              <li key={e.id}><button onClick={() => { setComposing(false); router.replace(`/inbox?email=${e.id}`); }} className={cx("block w-full px-3 py-2.5 text-left hover:bg-slate-50", email?.id === e.id && !composing && "bg-accent-50")}>
                <div className="flex justify-between gap-2 text-[12.5px]"><span className="truncate font-semibold">{displayAddr(e.from, state)}</span><span className="shrink-0 text-slate-500">{fmtShort(e.sentAt)}</span></div>
                <div className="truncate text-[12px] text-slate-500">to {e.to.map((t) => displayAddr(t, state)).join(", ")}</div>
                <div className="truncate text-[13px]">{e.subject}</div>
                <div className="mt-1 flex flex-wrap gap-1">{e.attachments.map((a) => <Chip key={a.id}>{a.name}</Chip>)}{e.origin === "ava_draft" && <Chip tone="blue">Sent from Ava's draft</Chip>}{e.origin === "composed" && <Chip tone="blue">Composed</Chip>}</div>
              </button></li>
            ))}
            {!emails.length && <li className="p-4"><Empty>No email yet. Press Start in the story bar, or compose one.</Empty></li>}
          </ul>
        </Card>
        {composing ? <Composer onDone={(id) => { setComposing(false); router.replace(`/inbox?email=${id}`); }} onCancel={() => setComposing(false)} /> : email ? <EmailView email={email} /> : <Empty>Select an email.</Empty>}
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

function AvaRecorded({ email }: { email: Email }) {
  const state = useAva((s) => s.state);
  const ex = state.extractions[email.id];
  const reqId = Object.values(state.requests).find((r) => r.emailIds.includes(email.id))?.id;
  const req = reqId ? state.requests[reqId] : undefined;
  const orphan = state.orphans.find((o) => o.emailId === email.id);
  const sup = state.suppliers.find((s) => s.id === req?.supplierId);
  const flags = req ? req.flags.filter((f) => f.createdAt === email.sentAt) : [];
  const conflicts = Object.values(state.conflicts).filter((c) => c.requestId === reqId && c.openedAt === email.sentAt);
  const changes = state.changes.filter((c) => c.requestId === reqId && c.at === email.sentAt);
  const a = reqId ? analyze(state, reqId) : undefined;
  return (
    <Card className="self-start">
      <CardHead title="Ava recorded" right={ex && ex.source !== "none" ? <Chip tone={ex.source === "basic" ? "amber" : "blue"}>{labelSource(ex.source)}</Chip> : undefined} />
      <div className="space-y-4 px-4 py-3 text-[13px]">
        {email.origin === "ava_draft" && <p>Ava's draft, sent by {personByEmail(email.from)?.name}. Recorded in the thread. No facts are extracted from our own questions.</p>}
        {req && <div><div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Filed under</div>
          <div className="mt-1 font-medium">{sup?.name ?? `Possible new supplier: ${req.supplierGuess?.name}`} › {req.project} › <Link className="text-accent hover:underline" href={`/requests/${req.id}`}>{req.id}</Link></div>
          <div className="mt-0.5 text-[12.5px] text-slate-600">{req.title}. Confidence: <b>{req.filing.confidence}</b>. {ex?.result?.filing.reason}</div></div>}
        {orphan && <div className="rounded-md bg-amber-50 px-3 py-2"><b>Invoice with no request.</b> {orphan.invoiceNo}, {lakh(orphan.amount)} before GST. {orphan.likelyOwnerId ? `Likely owner: ${personName(orphan.likelyOwnerId)} (named as "Attention" on the invoice).` : "No likely owner found."} <Link className="text-accent underline" href="/dashboard">See the dashboard card</Link></div>}
        {!req && !orphan && email.origin !== "ava_draft" && <p className="text-slate-600">Not filed: no supplier domain or commercial content in this email.</p>}
        {ex?.result && ex.result.facts.length > 0 && <div><div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Facts extracted</div>
          <ul className="space-y-1.5">{ex.result.facts.map((f, i) => {
            const att = email.attachments.find((x) => x.name.toLowerCase() === f.source.file.toLowerCase());
            return <li key={i} className="rounded-md border border-slate-100 px-2.5 py-1.5"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[12px] text-slate-500">{f.field.replace(/_/g, " ")}</span><StateChip state={f.state} /></div>
              <div className="font-medium">{f.value}</div><SourceLink src={{ emailId: email.id, file: f.source.file, attachmentId: att?.id, page: f.source.page, quote: f.source.quote }} label={`Source: ${f.source.file === "email" ? "email" : `${f.source.file}${f.source.page ? `, p.${f.source.page}` : ""}`}`} /></li>;
          })}</ul></div>}
        {(changes.length > 0 || flags.length > 0 || conflicts.length > 0) && <div><div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">What changed and who was told</div>
          <ul className="space-y-1">
            {changes.map((c) => <li key={c.id} className="text-red-800">{c.field}: {c.old} → {c.new}</li>)}
            {flags.map((f) => <li key={f.id}>Flag to {f.sendTo === "requester" ? personName(req?.requesterId) : f.sendTo.replace("_", " ")}: {f.message}</li>)}
            {conflicts.map((c) => <li key={c.id}>Conflict for {personName(c.ownerId)}: <Link className="text-accent underline" href={`/requests/${c.requestId}#conflicts`}>{c.title}</Link></li>)}
          </ul></div>}
        {a && <div className="rounded-md bg-slate-50 px-3 py-2 text-[12.5px]">Request now: <StateChip state={a.handoff.state} /> {a.spend.total > 0 && <>· 90-day total {lakh(a.spend.total)}</>} {a.waitingOn && <>· waiting on {a.waitingOn}</>}</div>}
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
      <CardHead title="New email" sub="Send any email, as anyone. It runs through the same pipeline as the scripted emails." right={<Button small variant="ghost" onClick={onCancel}>Cancel</Button>} />
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
        <div className="flex items-center gap-3 pt-1"><Button variant="primary" onClick={send} disabled={!!busy}>Send</Button>{busy && <span className="text-slate-500">{busy}</span>}<span className="ml-auto text-[12px] text-slate-500">Sent at {fmtShort(addMinutes(state.now, 1))} (simulated clock)</span></div>
      </div>
    </Card>
  );
}

function TryThis() {
  const state = useAva((s) => s.state); const ai = useAva((s) => s.aiAvailable);
  const sfm = state.threadRequest["t-sfm"] ? "t-sfm" : "";
  const items: { label: string; expect: string; d: Partial<Draft> }[] = [
    { label: "As Arjun, reply with a quote for ₹23L", expect: "A said-vs-written conflict; approvals reopen; 90-day total ₹41L if steps 1 to 9 ran.", d: { from: "arjun.d@trivenika.example", to: "rahul.mehta@prayaan.example", threadId: sfm, subject: "RE: Salesforce migration – can you help?", body: "Hi Rahul, our revised quote is attached. Regards, Arjun", files: [sampleAttachment("Trivenika_Quote_23L.pdf", uid("s"))] } },
    { label: "As Arjun: \"Our team has started work today\"", expect: "A started-before-approval conflict.", d: { from: "arjun.d@trivenika.example", to: "rahul.mehta@prayaan.example", threadId: sfm, subject: "RE: Salesforce migration – can you help?", body: "Hi Rahul, quick update: our team has started work today on the migration. Regards, Arjun" } },
    { label: "As a new supplier, send a quote", expect: "Possible new supplier, sent to Procurement.", d: { from: "sales@navkar.example", to: "karan.shah@prayaan.example", subject: "Quotation: office relocation", body: "Dear Karan, please find our quotation for the office relocation from Pune to Bengaluru. Regards, Navkar Logistics", files: [sampleAttachment("Navkar_Logistics_Quote.pdf", uid("s"))] } },
    { label: "As Rahul, ask a supplier to renew with no changes", expect: "A new renewal request.", d: { from: "rahul.mehta@prayaan.example", to: "arjun.d@trivenika.example", subject: "Renewal: Salesforce support retainer", body: "Hi Arjun, please renew the Salesforce support retainer for Q1 2027 with no changes. Thanks, Rahul" } },
    { label: "As Arjun, send an expired ISO certificate", expect: "The security certificate check reopens for InfoSec.", d: { from: "arjun.d@trivenika.example", to: "rahul.mehta@prayaan.example", threadId: sfm, subject: "RE: Salesforce migration – can you help?", body: "Hi Rahul, attached is our ISO certificate. Regards, Arjun", files: [sampleAttachment("Trivenika_ISO27001_expired.pdf", uid("s"))] } },
  ];
  return (
    <Card className="self-start">
      <CardHead title="Try this" sub={<>Each one pre-fills the composer. Extraction: <b>{ai ? "Live AI (key set)" : "Basic extraction (no API key on this deployment)"}</b>.</>} />
      <ul className="divide-y divide-slate-100">
        {items.map((it) => <li key={it.label} className="px-4 py-2.5"><button className="text-left text-[13px] font-medium text-accent hover:underline" onClick={() => prefill(it.d)}>{it.label}</button><div className="text-[12px] text-slate-500">Expect: {it.expect}</div></li>)}
      </ul>
      <p className="px-4 pb-3 text-[12px] text-slate-500">Tip: switch "View as" to act as each stakeholder after sending.</p>
    </Card>
  );
}
