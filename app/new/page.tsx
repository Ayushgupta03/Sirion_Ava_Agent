"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { buildIntake, EXAMPLES, parseIntake, previewIntake, type IntakeFields } from "@/lib/intake";
import { COST_CENTRES, PEOPLE, person, personName } from "@/lib/engine/world";
import { lakh } from "@/lib/format";
import { Button, Card, CardHead, Chip, cx, PageTitle } from "@/components/ui";
import { Icon } from "@/components/icons";

const REQUESTERS = PEOPLE.filter((p) => p.costCentre);
const field = "mt-0.5 block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px]";

export default function AskAva() {
  const state = useAva((s) => s.state); const viewAs = useAva((s) => s.viewAs); const addEmail = useAva((s) => s.addEmail); const setViewAs = useAva((s) => s.setViewAs);
  const router = useRouter();
  const [who, setWho] = useState(person(viewAs)?.costCentre ? viewAs : "neha");
  const [text, setText] = useState("");
  const [f, setF] = useState<IntakeFields | null>(null);
  const set = (k: keyof IntakeFields, v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
  const read = () => { if (text.trim().length > 8) setF(parseIntake(text, state.suppliers)); };
  const preview = useMemo(() => (f && f.supplierName ? previewIntake(state, f, who) : null), [state, f, who]);
  const cc = COST_CENTRES.find((c) => c.id === person(who)?.costCentre);
  const missing = f ? [!f.supplierName && "which supplier", !f.budget && "a rough budget", f.dataAccess === "unknown" && "whether they will touch customer data", f.supplierName && !f.supplierId && !f.supplierContact && "a contact at the supplier"].filter(Boolean) as string[] : [];
  const ready = !!f && !!f.supplierName && !!f.project && !!f.budget && f.dataAccess !== "unknown" && (!!f.supplierId || !!f.supplierContact);
  const submit = () => {
    if (!f || !ready) return;
    const known = state.suppliers.find((s) => s.id === f.supplierId);
    const { email, extraction } = buildIntake(f, who, state);
    addEmail(email, extraction, "basic");
    const rid = useAva.getState().state.threadRequest[email.threadId];
    if (who !== viewAs) setViewAs(who);
    router.push(rid ? `/requests/${rid}` : "/requests");
    void known;
  };
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title="Ask Ava" sub="Start before you talk to the supplier. Say what you need in your own words; Ava shows what it will take, and sends the routine first message." />
      <Card>
        <CardHead title="What do you need?" sub="No form. One or two sentences: the supplier, the work, a rough budget, and whether they will touch customer data." right={
          <label className="flex items-center gap-1.5 text-[12.5px] text-slate-600">Asking as
            <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[12.5px]">{REQUESTERS.map((p) => <option key={p.id} value={p.id}>{p.name} · {COST_CENTRES.find((c) => c.id === p.costCentre)?.name}</option>)}</select>
          </label>} />
        <div className="space-y-3 px-4 py-3">
          <textarea value={text} onChange={(e) => { setText(e.target.value); if (f) setF(null); }} rows={3} placeholder="e.g. I'd like Trivenika to build a campaign dashboard, about ₹6L, starting in 3 weeks. No customer data." className="block w-full rounded border border-slate-300 px-3 py-2 text-[14px]" aria-label="Describe what you need" />
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-slate-500">Try:</span>
            {EXAMPLES.map((e) => <button key={e.label} onClick={() => { setText(e.text); setWho(e.who); setF(parseIntake(e.text, state.suppliers)); }} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-50">{personName(e.who).split(" ")[0]}: {e.label}</button>)}
          </div>
          <div><Button variant="primary" onClick={read} disabled={text.trim().length < 9}>Ask Ava</Button></div>
        </div>
      </Card>

      {f && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Card>
            <CardHead title="Here is what Ava understood" sub={missing.length ? `Still needed: ${missing.join(", ")}.` : "Check it, change anything that is wrong."} />
            <div className="space-y-2.5 px-4 py-3 text-[13px]">
              <label className="block">Supplier{f.supplierId ? <Chip tone="green"> on the supplier list</Chip> : f.supplierName ? <Chip tone="amber"> not on the list: Procurement will check</Chip> : null}
                <input value={f.supplierName} onChange={(e) => setF({ ...f, supplierName: e.target.value, supplierId: state.suppliers.find((s) => s.name.toLowerCase().startsWith(e.target.value.toLowerCase().trim()) && e.target.value.trim().length > 3)?.id, supplierContact: state.suppliers.find((s) => s.name.toLowerCase().startsWith(e.target.value.toLowerCase().trim()) && e.target.value.trim().length > 3)?.contacts[0]?.email ?? f.supplierContact })} className={field} /></label>
              {f.supplierName && !f.supplierId && <label className="block">Your contact there (email)<input value={f.supplierContact} onChange={(e) => set("supplierContact", e.target.value)} placeholder="name@supplier.com" className={field} /></label>}
              <label className="block">What for<input value={f.project} onChange={(e) => set("project", e.target.value)} className={field} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">Rough budget, before GST<input value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="e.g. about ₹6L" className={field} /></label>
                <label className="block">How long<input value={f.duration} onChange={(e) => set("duration", e.target.value)} placeholder="e.g. 6 weeks" className={field} /></label>
              </div>
              <label className="block">Wanted start<input value={f.start} onChange={(e) => set("start", e.target.value)} placeholder="e.g. Monday, or in 3 weeks" className={field} /></label>
              <fieldset><legend>Will they access customer or personal data?</legend>
                <div className="mt-1 flex gap-2">{(["yes", "no"] as const).map((v) => <button key={v} type="button" aria-pressed={f.dataAccess === v} onClick={() => set("dataAccess", v)} className={cx("h-8 rounded-md border px-3 text-[13px] font-medium", f.dataAccess === v ? "border-accent bg-accent-50 text-accent-700" : "border-slate-300 bg-white hover:bg-slate-50")}>{v === "yes" ? "Yes" : "No"}</button>)}</div></fieldset>
              <p className="text-[12px] text-slate-500">Read with rules here. With a model key, the same fields come from the model. Either way the routing below is computed by code.</p>
            </div>
          </Card>

          <Card>
            <CardHead title="What this will take" sub={preview ? `${cc?.name ?? ""} · computed by the same rules as every request. Nothing is saved yet.` : "Name a supplier to see the route."} />
            {preview ? (
              <div className="space-y-3 px-4 py-3 text-[13px]">
                {preview.duplicateOf && <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-950"><b>Already open:</b> {preview.duplicateOf.id} ({preview.duplicateOf.title}). Your note will be added to it, not a second request.</p>}
                <div><div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-500">Who has to say yes</div>
                  <ul className="mt-1 space-y-1">{preview.approvals.map((a, i) => <li key={i} className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" /><span><b>{a.who}</b> <span className="text-slate-600">{a.why}</span></span></li>)}</ul></div>
                <p><b>90-day spend with this supplier:</b> <span className={cx("font-mono", preview.overLimit && "text-red-700")}>{preview.spendText.includes("+") ? preview.spendText : `${lakh(preview.spendTotal)}, this request only`}</span>{preview.overLimit ? ", over the ₹25L limit." : ", within the limit."}</p>
                <p><b>Ends in:</b> {preview.endState}.</p>
                <p className="rounded-md bg-slate-50 p-2.5 text-slate-700"><Icon name="clock" size={13} className="mr-1 inline text-slate-500" />{preview.gate}</p>
                {preview.newSupplier && <p className="text-amber-900">This supplier is not on the list. Karan Shah is asked to check and add them first; Ava drafts no message until then.</p>}
                {preview.draft && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                    <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-violet-900"><Icon name="mail" size={13} />{preview.draft.autoSent ? "Ava will send this for you" : "Ava will draft this for you to send"} to {preview.draft.to}</div>
                    <pre className="whitespace-pre-wrap font-sans text-[12.5px] text-slate-800">{preview.draft.body}</pre>
                    <p className="mt-1.5 text-[11.5px] text-slate-600">{preview.draft.autoSent ? "Auto-send is on for routine quote requests: no money, no terms. " : ""}Change this in <Link href="/settings" className="text-accent underline">Settings</Link>.</p>
                  </div>)}
              </div>
            ) : <p className="px-4 py-6 text-[13px] text-slate-500">Nothing to show yet.</p>}
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
              <Button variant="primary" onClick={submit} disabled={!ready}>Start the request</Button>
              {!ready && missing.length > 0 && <span className="text-[12.5px] text-slate-500">Add {missing[0]} to continue.</span>}
              {preview && ready && <span className="text-[12.5px] text-slate-500">{lakh(preview.spendTotal)} in 90 days · {preview.approvals.length} sign-off{preview.approvals.length === 1 ? "" : "s"} once the quote arrives</span>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
