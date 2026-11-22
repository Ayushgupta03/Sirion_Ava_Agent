"use client";
import { useState } from "react";
import { Card, CardHead, Chip, PageTitle } from "@/components/ui";
import ConnectDiagram from "@/components/ConnectDiagram";
import { useAva } from "@/lib/store";
import type { Autonomy } from "@/lib/types";

const LADDER: { level: string; name: string; what: string; tone: "grey" | "blue" | "green" | "red" }[] = [
  { level: "0", name: "Inform", what: "Ava tells the right person what changed and why.", tone: "grey" },
  { level: "1", name: "Draft", what: "Ava writes the message or the question; a person sends it. This is the default for everything.", tone: "blue" },
  { level: "2", name: "Send routine messages", what: "Ava sends it herself, in the requester's name, for message types you switch on below. Each is logged as an Ava action.", tone: "green" },
  { level: "Never", name: "Decide", what: "Approve, reject, resolve a dispute, accept a price, change a term, apply a credit. These stay with people, always.", tone: "red" },
];
const SWITCHES: { key: keyof Autonomy; title: string; text: string }[] = [
  { key: "autoSendQuoteRequests", title: "Quote requests from Ask Ava", text: "The first message to a supplier asking for a written proposal, with “do not start before a PO”. It commits no money and changes no terms." },
  { key: "autoSendDocChasers", title: "Document chasers", text: "Asking a supplier for an insurance or renewed security certificate that policy requires. Off by default, so the guided demo shows the draft path." },
];

function Autonomy() {
  const { state, act } = useAva();
  return (
    <Card><CardHead title="What Ava may do without a click" sub="Autonomy is per kind of message, never per decision. Switching one on is logged." />
      <ol className="grid gap-2 px-4 pt-3 sm:grid-cols-2 lg:grid-cols-4">{LADDER.map((l) => (
        <li key={l.level} className="rounded-lg border border-slate-200 p-3 text-[13px]"><div className="flex items-center gap-2"><Chip tone={l.tone}>{l.level === "Never" ? "Never" : `Level ${l.level}`}</Chip><b>{l.name}</b></div><p className="mt-1 text-slate-600">{l.what}</p></li>))}</ol>
      <ul className="divide-y divide-slate-100 px-4 py-2">{SWITCHES.map((w) => (
        <li key={w.key}><label className="flex items-start gap-3 py-3 text-[14px]">
          <input type="checkbox" checked={!!state.autonomy?.[w.key]} onChange={(e) => act({ type: "set_autonomy", setting: w.key, value: e.target.checked })} className="mt-1 h-4 w-4" />
          <span><b className="block">{w.title}</b><span className="text-[13px] text-slate-600">{w.text}</span></span></label></li>))}</ul>
    </Card>
  );
}

export default function Settings() {
  const [show, setShow] = useState(true);
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title="Settings" sub="How Ava connects, and what she may read." />
      <Autonomy />
      <section><h2 className="mb-2 text-[15px] font-semibold">How Ava connects</h2><ConnectDiagram /></section>
      <Card><CardHead title="Scope" /><p className="px-4 py-3 text-[14px]">Copies of email between employees and supplier domains, plus contracts@, through a mail rule IT controls.</p></Card>
      <Card><CardHead title="Exclusions" /><div className="flex gap-2 px-4 py-3">{["HR", "Board", "Outside counsel"].map((x) => <Chip key={x}>{x}</Chip>)}</div></Card>
      <Card><CardHead title="Attachment types allowed" /><div className="flex gap-2 px-4 py-3">{["PDF", "XLSX", "DOCX", "CSV"].map((x) => <Chip key={x} tone="blue">{x}</Chip>)}</div></Card>
      <Card><CardHead title="Data retention" /><p className="px-4 py-3 text-[14px]">Email bodies and attachments kept for 7 years with the request record. Emails Ava did not file are discarded after 30 days.</p></Card>
      <Card><CardHead title="Transparency" /><label className="flex items-center gap-3 px-4 py-3 text-[14px]"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4" />Employees can see what Ava captured from their mail</label></Card>
      <p className="text-[13px] text-slate-500">Autonomy switches are enforced by the engine. The rest of this page is illustrative.</p>
    </div>
  );
}
