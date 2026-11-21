"use client";
import { useState } from "react";
import { Card, CardHead, Chip, PageTitle } from "@/components/ui";
import ConnectDiagram from "@/components/ConnectDiagram";

export default function Settings() {
  const [show, setShow] = useState(true);
  return (
    <div className="max-w-5xl space-y-4">
      <PageTitle title="Settings" sub="How Ava connects, and what she may read." />
      <section><h2 className="mb-2 text-[15px] font-semibold">How Ava connects</h2><ConnectDiagram /></section>
      <Card><CardHead title="Scope" /><p className="px-4 py-3 text-[14px]">Copies of email between employees and supplier domains, plus contracts@, through a mail rule IT controls.</p></Card>
      <Card><CardHead title="Exclusions" /><div className="flex gap-2 px-4 py-3">{["HR", "Board", "Outside counsel"].map((x) => <Chip key={x}>{x}</Chip>)}</div></Card>
      <Card><CardHead title="Attachment types allowed" /><div className="flex gap-2 px-4 py-3">{["PDF", "XLSX", "DOCX", "CSV"].map((x) => <Chip key={x} tone="blue">{x}</Chip>)}</div></Card>
      <Card><CardHead title="Data retention" /><p className="px-4 py-3 text-[14px]">Email bodies and attachments kept for 7 years with the request record. Emails Ava did not file are discarded after 30 days.</p></Card>
      <Card><CardHead title="Transparency" /><label className="flex items-center gap-3 px-4 py-3 text-[14px]"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4" />Employees can see what Ava captured from their mail</label></Card>
      <p className="text-[13px] text-slate-500">Illustrative; not enforced in the prototype.</p>
    </div>
  );
}
