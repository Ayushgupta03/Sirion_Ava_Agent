"use client";
// The supplier's side of one request: what Prayaan has asked for, and a place to answer. A reply here is an email event through the same pipeline.
import { use, useState } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { analyze } from "@/lib/engine/rules";
import { extractForEmail, uploadForText } from "@/lib/extractClient";
import { sampleAttachment, SAMPLE_GROUPS } from "@/lib/samples";
import { addMinutes, fmtDT, uid } from "@/lib/format";
import { PEOPLE, personName } from "@/lib/engine/world";
import type { Attachment, Email } from "@/lib/types";
import { Button, Card, CardHead, Chip, Empty, supplierShort } from "@/components/ui";

export default function SupplierPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useAva((s) => s.state); const addEmail = useAva((s) => s.addEmail);
  const req = state.requests[id];
  const [body, setBody] = useState(""); const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  if (!req) return <Empty>No such request. <Link className="text-accent underline" href="/requests">Back to requests</Link></Empty>;
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  const contact = sup?.contacts[0];
  const a = analyze(state, id);
  const out = state.emails.filter((e) => req.emailIds.includes(e.id) && e.origin === "ava_draft").sort((x, y) => y.sentAt.localeCompare(x.sentAt));
  const needed = a.checklist.filter((c) => c.status === "pending" && ["insurance", "security_cert"].includes(c.key));
  const waitingOnYou = !!a.waitingOn && sup && a.waitingOn.startsWith(supplierShort(sup.name).split(" ")[0]);
  const threadId = out[out.length - 1]?.threadId ?? state.emails.find((e) => e.id === req.emailIds[0])?.threadId ?? `t-${req.id}`;
  const mine = SAMPLE_GROUPS.flatMap((g) => g.files).filter((f) => sup && f.toLowerCase().startsWith(supplierShort(sup.name).split(" ")[0].toLowerCase()));

  const upload = async (list: FileList | null) => {
    if (!list) return; setErr(null);
    for (const f of Array.from(list)) {
      setBusy(`Reading ${f.name}…`);
      try { const t = await uploadForText(f); setFiles((x) => [...x, { id: uid("up"), name: f.name, kind: t.kind, pages: t.pages, sheets: t.sheets }]); } catch (e: any) { setErr(e.message); }
    }
    setBusy(null);
  };
  const send = async () => {
    if (!contact || (!body.trim() && !files.length)) return;
    const mid = uid("m");
    const requester = state.requests[id].requesterId;
    const email: Email = { id: mid, threadId, from: contact.email, to: [PEOPLE.find((p) => p.id === requester)?.email ?? ""], cc: [], subject: `RE: ${out[out.length - 1]?.subject.replace(/^re:\s*/i, "") ?? req.title}`, body: body.trim() || "Please find the documents attached.", sentAt: addMinutes(state.now, 1), attachments: files.map((f, i) => ({ ...f, id: `${mid}-att${i + 1}` })), origin: "composed" };
    setBusy("Prayaan's system is reading your reply…");
    const r = await extractForEmail(email, state);
    addEmail(email, r.result, r.source);
    setBusy(null); setBody(""); setFiles([]); setDone(`Received at ${fmtDT(email.sentAt)}. ${personName(requester).split(" ")[0]} and Procurement can see it now.`);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-950">
        <b>Supplier view.</b> This is what {supplierShort(sup?.name ?? req.supplierGuess?.name)} sees for {req.id}. Nothing internal is shown: no approvers, no limits, no other suppliers.
        <Link href={`/requests/${id}`} className="ml-2 text-accent underline">Back to the internal view</Link>
      </div>
      <header><p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-500">Prayaan Software · supplier portal</p>
        <h1 className="text-[22px] font-semibold">{req.project}</h1>
        <p className="text-[13.5px] text-slate-600">Contact at Prayaan: {personName(req.requesterId)}. {waitingOnYou ? <b className="text-amber-900">We are waiting on you.</b> : "Prayaan is working on this."}</p></header>

      <Card><CardHead title="What we have asked for" sub="Newest first." />
        {out.length ? <ul className="divide-y divide-slate-100">{out.map((e) => (
          <li key={e.id} className="px-4 py-3 text-[13px]"><div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">{fmtDT(e.sentAt)} {e.autoSent && <Chip tone="blue">Sent by Ava, routine</Chip>}</div><pre className="mt-1 whitespace-pre-wrap font-sans text-[13px] text-slate-800">{e.body}</pre></li>))}</ul> : <p className="px-4 py-3 text-[13px] text-slate-500">Nothing yet. Prayaan has not contacted you about this.</p>}
        {needed.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-[13px]"><b>Still needed:</b> <ul className="mt-1 list-disc pl-5">{needed.map((c) => <li key={c.key}>{c.label}</li>)}</ul></div>}
      </Card>

      <Card><CardHead title="Send us a reply" sub={contact ? `Sent as ${contact.name} (${contact.email}). It reaches Prayaan as an ordinary email on this thread.` : "No contact on file for this supplier."} />
        <div className="space-y-2.5 px-4 py-3 text-[13px]">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Add a note (optional)" className="block w-full rounded border border-slate-300 px-3 py-2" aria-label="Your message" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-slate-300 px-2.5 py-1.5 text-[12.5px] hover:bg-slate-50">Upload PDF or XLSX<input type="file" accept=".pdf,.xlsx,.xls" multiple className="sr-only" onChange={(e) => upload(e.target.files)} /></label>
            <select aria-label="Add a sample document" value="" onChange={(e) => { if (e.target.value) setFiles((x) => [...x, sampleAttachment(e.target.value, uid("s"))]); }} className="rounded border border-slate-300 px-2 py-1.5 text-[12.5px]">
              <option value="">Or add a sample document…</option>{mine.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          </div>
          <div className="flex flex-wrap gap-1.5">{files.map((f) => <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px]">{f.name}<button aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} className="text-slate-500 hover:text-red-600">×</button></span>)}</div>
          {err && <p className="text-red-700">{err}</p>}
          <div className="flex items-center gap-3"><Button variant="primary" onClick={send} disabled={!!busy || !contact || (!body.trim() && !files.length)}>Send to Prayaan</Button>{busy && <span className="text-slate-500">{busy}</span>}</div>
          {done && <p className="rounded-md bg-emerald-50 p-2.5 text-emerald-900">{done} <Link className="underline" href={`/requests/${id}`}>See what changed on the request</Link></p>}
        </div>
      </Card>
    </div>
  );
}
