"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAva } from "@/lib/store";
import { resolveFocus } from "@/lib/story";
import { deriveItems } from "@/lib/engine/items";
import { person } from "@/lib/engine/world";
import { Icon, type IconName } from "@/components/icons";
import { initials, roleOf } from "@/components/Shell";

const MOMENTS = [
  { step: "Step 1", title: "A normal email starts the request", text: "Rahul tells the supplier “Rough budget is about ₹20L.” Ava opens REQ-1047 and adds 90 days of spend: ₹9L + ₹9L + ₹20L = ₹38L, over the ₹25L limit." },
  { step: "Step 6", title: "The PDF says ₹1.5L more", text: "The email says “please find the updated quote attached.” Only the PDF shows a new ₹1,50,000 line. Ava catches it." },
  { step: "Step 7", title: "Approvals reopen, handoff stops", text: "Ananya approved ₹20L and Vikram ₹38L. Both receipts change to Needs reconfirmation, with the PDF line as the source." },
];

export default function Overview() {
  const { state, pos, reset, setViewAs } = useAva();
  const router = useRouter();
  const items = useMemo(() => deriveItems(state), [state]);
  const ready = state.requestOrder.filter((id) => state.requests[id].readyAt).length;
  const docFacts = state.counters.answeredFromDocs;
  const start = () => { if (pos.A > 0) reset(); const f = useAva.getState().next(); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const FLOW: { icon: IconName; title: string; text: string; stat: string; href: string }[] = [
    { icon: "mail", title: "Email arrives", text: "An employee writes to a supplier as usual. No form, no portal.", stat: `${state.emails.length} email${state.emails.length === 1 ? "" : "s"} recorded`, href: "/inbox" },
    { icon: "file", title: "Ava reads it", text: "Facts from the email and every attachment, each linked to its sentence or PDF line.", stat: `${docFacts} answered from documents`, href: "/inbox" },
    { icon: "list", title: "Request is routed", text: "Filed under supplier › project › request. Rules add up spend and pick approvers.", stat: `${state.requestOrder.length} request${state.requestOrder.length === 1 ? "" : "s"}`, href: "/requests" },
    { icon: "users", title: "Each person gets one question", text: "InfoSec, Legal, Finance, approvers: each sees only what is waiting on them.", stat: `${items.length} open item${items.length === 1 ? "" : "s"}`, href: "/items" },
    { icon: "send", title: "Handoff", text: "Ready for Legal Review or Ready to issue PO, only when every approval matches the latest facts.", stat: `${ready} ready`, href: "/dashboard" },
  ];
  return (
    <div className="enter space-y-10">
      <section className="max-w-4xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-accent">Contract intake · Sirion case study prototype</p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[42px]">Supplier email in. Routed request out.</h1>
        <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-slate-700">Nobody fills in an intake form. Ava builds the contract request from the emails people already send to suppliers, and the request cannot leave intake until every approval matches the latest facts.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={start} className="flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-700"><Icon name="play" size={15} />Start the guided demo</button>
          <Link href="/inbox?compose=1" className="flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-[14px] font-medium hover:bg-slate-50"><Icon name="mail" />Send your own email</Link>
          <span className="text-[13px] text-slate-500">9 steps, about 3 minutes. The demo bar stays at the bottom of every page.</span>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-[13px] font-semibold uppercase tracking-[0.05em] text-slate-500">How it works · live counts from this session</h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-5">
          {FLOW.map((f, i) => (
            <li key={f.title} className="relative">
              <Link href={f.href} className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 hover:border-accent">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-50 text-accent"><Icon name={f.icon} size={18} /></span>
                  <span className="font-mono text-[12px] text-slate-400">0{i + 1}</span>
                </div>
                <h3 className="mt-3 text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-1 flex-1 text-[13px] leading-relaxed text-slate-600">{f.text}</p>
                <p className="mt-3 border-t border-slate-100 pt-2 font-mono text-[12.5px] text-slate-700">{f.stat}</p>
              </Link>
              {i < FLOW.length - 1 && <Icon name="arrowRight" size={16} className="absolute -right-[13px] top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-canvas text-slate-400 md:block" />}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-slate-500">Three moments to watch in Scenario A</h2>
          <ol className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {MOMENTS.map((m) => (
              <li key={m.step} className="flex gap-4 p-4">
                <span className="mt-0.5 h-fit rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[12px] text-slate-600">{m.step}</span>
                <div><h3 className="text-[15px] font-semibold">{m.title}</h3><p className="mt-0.5 text-[13.5px] leading-relaxed text-slate-600">{m.text}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-[14px] font-semibold">Different from a typical intake tool</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] text-slate-700">
              {["No form, no portal, no forwarding.", "Ava reads attachments, not just email text.", "An approval belongs to the facts it was given for."].map((t) => <li key={t} className="flex gap-2"><Icon name="check" className="mt-0.5 shrink-0 text-emerald-600" />{t}</li>)}
            </ul>
          </div>
        </div>
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-slate-500">Try it as one of them</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {["rahul", "karan", "meera", "ananya", "vikram", "farah"].map((id) => { const n = items.filter((i) => i.personId === id).length; return (
              <li key={id}><button onClick={() => { setViewAs(id); router.push("/items"); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-100 text-[12px] font-semibold text-accent-700">{initials(id)}</span>
                <span className="flex-1 leading-tight"><span className="block text-[13.5px] font-medium">{person(id)?.name}</span><span className="block text-[12px] text-slate-500">{roleOf(id)}</span></span>
                <span className="text-[12px] text-slate-500">{n ? `${n} waiting` : "nothing waiting"}</span><Icon name="chevronRight" className="text-slate-400" />
              </button></li>); })}
          </ul>
          <p className="mt-2 text-[12.5px] text-slate-500">All people, companies and amounts are fictional. Every screen is computed from one live event log.</p>
        </div>
      </section>
    </div>
  );
}
