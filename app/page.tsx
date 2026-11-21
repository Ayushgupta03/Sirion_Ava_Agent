"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAva } from "@/lib/store";
import { resolveFocus } from "@/lib/story";
import { deriveItems } from "@/lib/engine/items";
import { cx } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const TABS: { k: string; verb: string; img: string; alt: string; line: string; href: string }[] = [
  { k: "record", verb: "Record", img: "/screens/record.png", alt: "The Inbox with the Ava recorded panel: the email is filed under Trivenika Systems, Salesforce migration, REQ-1047.", line: "Rahul writes to a supplier as usual. Ava files it as REQ-1047 and pulls out the amount, start date and duration, each linked to its sentence.", href: "/inbox" },
  { k: "check", verb: "Check", img: "/screens/check.png", alt: "The change banner: price changed in the attachment, ₹20,00,000 to ₹21,50,000. The email body says nothing about price.", line: "The email says “updated quote attached”. Only the PDF shows ₹1,50,000 more. Ava catches it and stops the handoff.", href: "/inbox" },
  { k: "route", verb: "Route", img: "/screens/route.png", alt: "Meera Nair's My work list with one question: confirm the security certificate covers CRM data.", line: "Each person gets only what needs them, with one question each. Here, InfoSec is asked one thing.", href: "/items" },
  { k: "track", verb: "Track", img: "/screens/track.png", alt: "The dashboard pipeline with requests by stage and the timing panel.", line: "Every request by stage, who it waits on, and how long intake took against a one-day target.", href: "/dashboard" },
];

export default function Landing() {
  const { state, reset, jumpTo } = useAva();
  const router = useRouter();
  const [tab, setTab] = useState("record");
  const items = useMemo(() => deriveItems(state), [state]);
  const cur = TABS.find((t) => t.k === tab)!;
  const watchA = () => { reset(); const f = useAva.getState().next(); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const watchB = () => { const f = jumpTo("B", 1); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const TRUST: [IconName, string][] = [["file", "Every fact links to the sentence it came from."], ["shield", "Ava only receives supplier email, through a mail rule your IT team controls."]];
  return (
    <div className="enter mx-auto max-w-[1100px] space-y-8">
      <section className="max-w-3xl">
        <h1 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] text-slate-900 sm:text-[46px]">Supplier email in. Routed request out.</h1>
        <p className="mt-4 text-[18px] leading-relaxed text-slate-700">Ava records every supplier email, checks it against what was agreed, and routes it to the one person who must act.</p>
        <ul className="mt-4 flex flex-col gap-2 text-[14px] text-slate-700 sm:flex-row sm:gap-6">
          {TRUST.map(([i, t]) => <li key={t} className="flex items-start gap-2"><Icon name={i} className="mt-0.5 shrink-0 text-accent" />{t}</li>)}
        </ul>
      </section>

      <section aria-label="What Ava does" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div role="tablist" aria-label="What Ava does" className="grid grid-cols-4 border-b border-slate-200">
          {TABS.map((t, i) => (
            <button key={t.k} role="tab" id={`tab-${t.k}`} aria-selected={tab === t.k} aria-controls="landing-panel" onClick={() => setTab(t.k)} className={cx("border-b-2 px-2 py-3 text-center text-[14px] sm:text-[15px]", tab === t.k ? "border-accent font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
              <span className="mr-1.5 hidden font-mono text-[12px] text-slate-400 sm:inline">0{i + 1}</span>{t.verb}
            </button>
          ))}
        </div>
        <div id="landing-panel" role="tabpanel" aria-labelledby={`tab-${cur.k}`} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-center md:p-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.img} alt={cur.alt} className="block h-auto w-full" />
          </div>
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{cur.verb}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{cur.line}</p>
            <Link href={cur.href} className="mt-3 inline-block text-[14px] font-medium text-accent hover:underline">Open the real screen →</Link>
            <p className="mt-2 text-[12px] text-slate-500">Screenshots of this prototype. All data is fictional.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <button onClick={watchA} className="flex h-12 items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-700"><Icon name="play" size={15} />Watch Scenario A: new project (3 min)</button>
        <button onClick={watchB} className="flex h-12 items-center gap-2 rounded-lg border border-accent bg-white px-5 text-[15px] font-semibold text-accent-700 hover:bg-accent-50"><Icon name="play" size={15} />Watch Scenario B: renewal (2 min)</button>
        <Link href="/inbox?compose=1" className="text-[14px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900">or send your own email</Link>
      </section>

      <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 pt-4 font-mono text-[12.5px] text-slate-500">
        <span>This session: {state.emails.length} email{state.emails.length === 1 ? "" : "s"} recorded</span><span>{state.requestOrder.length} requests</span><span>{items.length} open items</span><span>{state.requestOrder.filter((id) => state.requests[id].readyAt).length} ready</span><span>0 forms filled</span>
      </p>
    </div>
  );
}
