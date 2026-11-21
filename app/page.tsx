"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAva } from "@/lib/store";
import { resolveFocus } from "@/lib/story";

const MOMENTS = [
  { n: "1", title: "The first email", text: "Rahul writes to a supplier: “Rough budget is about ₹20L. Can your team start Monday?” He fills in nothing. Ava opens REQ-1047, adds up 90 days of spend (₹9L + ₹9L + ₹20L = ₹38L) and routes it to the VP." },
  { n: "2", title: "The PDF raises the price by ₹1.5L", text: "The supplier's email says “please find the updated quote attached.” Nothing about price. Ava reads Proposal_v2.pdf, finds a new line for ₹1,50,000 and a subtotal of ₹21,50,000." },
  { n: "3", title: "Approvals reopen. Handoff is blocked.", text: "Ananya approved ₹20L. Vikram approved ₹38L. Both receipts change to Needs reconfirmation, with old and new values and the PDF line as the source." },
];

export default function Landing() {
  const { next, reset, pos } = useAva();
  const router = useRouter();
  const start = () => { if (pos.A > 0) reset(); const f = useAva.getState().next(); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Contract intake · Prototype for the Sirion case study</p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight text-slate-900">Nobody fills in an intake form. Ava builds the contract request from the emails people already send to suppliers, and the request cannot leave intake until every approval matches the latest facts.</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold">What we provide</h2>
          <ul className="mt-2 space-y-1.5 text-[14px] text-slate-700">
            <li><b>Ava</b>, an AI agent owned by the company. She records every email and attachment exchanged with suppliers and turns each conversation into a structured, routed contract request.</li>
            <li><b>A dashboard</b> where each department sees only what is waiting on it, with one question each.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold">Different from a typical intake tool</h2>
          <ul className="mt-2 space-y-1.5 text-[14px] text-slate-700">
            <li>No form, no portal, no forwarding.</li>
            <li>Ava reads attachments, not just email text.</li>
            <li>An approval belongs to the facts it was given for.</li>
          </ul>
        </div>
      </div>
      <h2 className="mt-8 text-[15px] font-semibold">The three moments to watch</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {MOMENTS.map((m) => (
          <div key={m.n} className="rounded-lg border border-slate-200 p-4">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-accent-50 text-[13px] font-bold text-accent-700">{m.n}</div>
            <h3 className="mt-2 font-semibold">{m.title}</h3>
            <p className="mt-1 text-[13.5px] text-slate-700">{m.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button onClick={start} className="rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:bg-accent-700">Start the demo</button>
        <Link href="/inbox?compose=1" className="rounded-md border border-slate-300 px-4 py-3 text-[14px] font-medium hover:bg-slate-50">Or send your own email</Link>
        <span className="text-[13px] text-slate-500">Use “View as” at the top to act as any stakeholder. Every screen is computed live from one event log.</span>
      </div>
      <div className="mt-8 rounded-lg bg-slate-50 p-4 text-[13px] text-slate-700">
        <b>How to judge it end to end.</b> Play Scenario A with Next step, or do it by hand: Reset, then Inbox › New email as Rahul, reply as Arjun with a sample PDF, switch View as to approve. The same engine produces the same numbers either way. Scenario B (a software renewal) and the repeat-request contrast are in the story bar.
      </div>
    </div>
  );
}
