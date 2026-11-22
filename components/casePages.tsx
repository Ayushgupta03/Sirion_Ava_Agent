"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAva } from "@/lib/store";
import { analyze } from "@/lib/engine/rules";
import { timingFor } from "@/lib/engine/timing";
import { northStar } from "@/lib/insights";
import { person } from "@/lib/engine/world";
import { cx } from "./ui";
import { Icon, type IconName } from "./icons";
import { DemoLink, Ext, Section, StoryFrame } from "./story";
import { initials } from "./Shell";
import ConnectDiagram from "./ConnectDiagram";

const card = "rounded-xl border border-slate-200 bg-white";
const label = "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-500";

// ───────────────────────── 01 Why intake ─────────────────────────
const STAGES = ["Request", "Intake", "Negotiation", "Signature", "Repository", "Obligations and invoices"];
const TRACE: { symptom: string; where: string; cause: string; demo: [("A" | "B"), number, string] }[] = [
  { symptom: "Requests get lost", where: "Intake", cause: "The request lives in one person's inbox. Nobody else knows it exists.", demo: ["A", 1, "A normal email opens REQ-1047"] },
  { symptom: "Approvals stall", where: "Intake", cause: "Approvers are asked before the facts are complete, so they wait or ask again.", demo: ["A", 4, "Each person gets one question"] },
  { symptom: "Invoices don't match agreed prices", where: "Invoices", cause: "The price changed in an attachment after someone approved the old one.", demo: ["A", 6, "The PDF says ₹1.5L more"] },
  { symptom: "Unreviewed auto-renewals", where: "Obligations", cause: "Renewal terms in the order form were never compared with what was agreed.", demo: ["B", 1, "Email says nothing changes; the form says 3 years"] },
  { symptom: "Work starts before approval", where: "Invoices", cause: "Nothing is on record until the invoice arrives.", demo: ["B", 3, "An invoice arrives before approval"] },
];

export function WhyIntake() {
  return (
    <StoryFrame slug="why" answer="Every later stage runs on facts captured at intake. If intake misses them, no later tool can get them back.">
      <Section title="Where intake sits" sub="Ava works on the highlighted stage and stops at a clean handoff.">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s, i) => (
            <li key={s} className={cx("relative rounded-xl border p-3", s === "Intake" ? "border-accent bg-accent-50" : "border-slate-200 bg-white")}>
              <span className="font-mono text-[11px] text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <span className={cx("block text-[14px] font-semibold", s === "Intake" ? "text-accent-700" : "text-slate-700")}>{s}</span>
              {s === "Intake" && <span className="mt-1 inline-block rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">Ava works here</span>}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Five failures the brief describes, traced back to intake" sub="Each symptom shows up later, but starts with something intake did not capture. Each one is a step you can replay.">
        <div className={cx(card, "divide-y divide-slate-100")}>
          <div className="hidden grid-cols-[1fr_1.4fr_auto] gap-4 px-4 py-2 md:grid"><span className={label}>Symptom, and where it shows up</span><span className={label}>What intake failed to capture</span><span className={label}>In the demo</span></div>
          {TRACE.map((t) => (
            <div key={t.symptom} className="grid gap-2 px-4 py-3.5 md:grid-cols-[1fr_1.4fr_auto] md:items-center md:gap-4">
              <div><span className="block text-[14.5px] font-semibold text-slate-900">{t.symptom}</span><span className="text-[12.5px] text-slate-500">Shows up in: {t.where}</span></div>
              <p className="flex gap-2 text-[14px] text-slate-700"><Icon name="arrowRight" className="mt-1 hidden shrink-0 rotate-180 text-slate-400 md:block" />{t.cause}</p>
              <DemoLink sc={t.demo[0]} step={t.demo[1]}>{t.demo[2]}</DemoLink>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Why not negotiation or the repository" sub="Both depend on what intake captured.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Intake", "Creates the facts and the routing every later stage uses.", true],
            ["Negotiation", "Starts well only if the request arrives complete: the right price, scope, data access and approvals.", false],
            ["Repository", "Can only store and search what was captured. Terms that never reached a contract are invisible to it.", false],
          ].map(([t, d, pick]) => (
            <div key={t as string} className={cx("rounded-xl border p-4", pick ? "border-accent bg-accent-50" : "border-slate-200 bg-white")}>
              <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">{t as string}</h3>{pick ? <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">Chosen</span> : <span className="text-[12px] text-slate-500">Depends on intake</span>}</div>
              <p className="mt-1.5 text-[13.5px] text-slate-700">{d as string}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Where Ava stops" sub="A request leaves intake only when every approval matches the latest facts. Then it goes one of two ways.">
        <div className="grid gap-3 md:grid-cols-2">
          <EndState icon="lock" title="Ready for Legal Review" when={["A new agreement is needed", "The supplier will access personal or customer data", "The supplier proposed non-standard terms"]} demo={<DemoLink sc="A" step={9}>Scenario A ends here</DemoLink>} />
          <EndState icon="check" title="Ready to issue PO" when={["Repeat work under an existing agreement", "No data access", "Within approval limits: only the budget owner approves"]} demo={<DemoLink sc="B" step={5}>Scenario B ends here</DemoLink>} />
        </div>
      </Section>
    </StoryFrame>
  );
}
function EndState({ icon, title, when, demo }: { icon: IconName; title: string; when: string[]; demo: ReactNode }) {
  return (
    <div className={cx(card, "p-4")}>
      <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name={icon} size={18} /></span><h3 className="text-[16px] font-semibold">{title}</h3></div>
      <p className={cx(label, "mt-3")}>When</p>
      <ul className="mt-1 space-y-1 text-[14px] text-slate-700">{when.map((w) => <li key={w} className="flex gap-2"><Icon name="check" className="mt-0.5 shrink-0 text-emerald-600" />{w}</li>)}</ul>
      <div className="mt-3">{demo}</div>
    </div>
  );
}

// ───────────────────────── 02 The problem ─────────────────────────
const STATS = [
  { n: "49%", t: "of legal teams still manage contracts with email and shared folders.", src: "SpotDraft, 2025", href: "https://spotdraft.com/benchmarking-report-2025" },
  { n: "15–30 min", t: "of intake per request before any review work begins.", src: "LegalOn", href: "https://www.legalontech.com/post/in-house-legal-productivity" },
  { n: "54%", t: "of legal-ops teams name streamlining intake as a priority this year.", src: "Checkbox, 2025", href: "https://www.checkbox.ai/2025-insights-report/redefining-legal-intake" },
  { n: "~30%", t: "of indirect spend happens off-contract.", src: "The Hackett Group, via Esker", href: "https://www.esker.com/blog/source-to-pay/what-is-maverick-spend/" },
  { n: "~9%", t: "of value lost each year by the average business to poor contract management.", src: "WorldCC, 2025", href: "https://info.worldcc.com/contract-management-aug-2025" },
];
const HURTS: { who: string; pain: string; cost: string; icon: IconName }[] = [
  { who: "Requesters", pain: "Fill in forms, re-explain the deal, chase status.", cost: "Days of delay, so they route around the process.", icon: "users" },
  { who: "Procurement", pain: "Rebuild each request from forwarded threads.", cost: "Spend over limits is found after commitment.", icon: "list" },
  { who: "Legal", pain: "Chase missing basics before reviewing anything.", cost: "15–30 minutes lost per request.", icon: "lock" },
  { who: "Finance", pain: "Receive invoices with no request or PO behind them.", cost: "Off-contract spend; prices that don't match.", icon: "chart" },
  { who: "InfoSec", pain: "Learn about customer-data access after work starts.", cost: "Unreviewed suppliers holding customer data.", icon: "shield" },
];
const HYP = [
  { h: "People under-report data access.", test: "Compare what requesters say with what supplier documents show.", wrong: "Fewer than 1 in 20 requests show undisclosed access." },
  { h: "People split purchases to stay under limits.", test: "Count requests that cross ₹25L only on the 90-day total.", wrong: "Cumulative breaches are rare." },
  { h: "People delay approvals out of fear of blame.", test: "Compare time to approve with and without Decision Receipts.", wrong: "Receipts do not shorten approval time." },
];

export function Problem() {
  return (
    <StoryFrame slug="problem" answer="Contract requests start in email, so the facts that decide price, routing and risk are scattered and unchecked.">
      <Section title="The evidence" sub="Industry data. Each number links to its source.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STATS.map((s) => (
            <a key={s.n} href={s.href} target="_blank" rel="noreferrer" className={cx(card, "flex flex-col p-4 hover:border-accent")}>
              <span className="font-mono text-[28px] font-medium leading-none tracking-[-0.02em] text-slate-900">{s.n}</span>
              <span className="mt-2 flex-1 text-[13.5px] leading-snug text-slate-700">{s.t}</span>
              <span className="mt-3 text-[12px] font-medium text-accent">{s.src} ↗</span>
            </a>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-slate-500">Requests also arrive without the basics, so legal teams chase people to fill the gaps (<Ext href="https://legalontech.com/post/fixing-in-house-legals-biggest-hidden-bottleneck">LegalOn</Ext>).</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-[13.5px] text-amber-950"><b className="block">How sure are we?</b>Every number above comes from a vendor or industry write-up, and several vendors sell intake tools. Treat them as direction, not proof. We have no interviews or internal data yet. Week 1 of the pilot replaces these figures with Prayaan&apos;s own: a sample of 50 closed requests, and five conversations with a requester, a buyer, an approver, a lawyer and someone in Finance.</div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-[13.5px] text-slate-700"><b className="block text-slate-900">What the sizing says, as an assumption</b>About 200 requests a month at 15 to 30 minutes of intake each is 50 to 100 hours a month spent before anyone reviews anything. That is the cost of intake alone. It excludes the larger cost of a wrong approval or an invoice nobody expected, which is why the prototype counts rework avoided and ₹ caught separately.</div>
        </div>
      </Section>

      <Section title="Who it hurts, and what it costs them">
        <div className={cx(card, "divide-y divide-slate-100")}>
          {HURTS.map((h) => (
            <div key={h.who} className="grid gap-1 px-4 py-3 md:grid-cols-[180px_1fr_1fr] md:items-center md:gap-4">
              <span className="flex items-center gap-2.5 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon name={h.icon} /></span>{h.who}</span>
              <span className="text-[14px] text-slate-700">{h.pain}</span>
              <span className="text-[14px] font-medium text-red-800">{h.cost}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Our view of the root cause" sub="We believe the cause is human: the official process feels slow and punishing, so people route around it. The pilot tests three hypotheses.">
        <div className="grid gap-3 md:grid-cols-3">
          {HYP.map((h, i) => (
            <div key={h.h} className={cx(card, "flex flex-col p-4")}>
              <span className="font-mono text-[12px] text-slate-400">Hypothesis {i + 1}</span>
              <h3 className="mt-1 text-[15px] font-semibold">{h.h}</h3>
              <p className={cx(label, "mt-3")}>How the pilot tests it</p><p className="text-[13.5px] text-slate-700">{h.test}</p>
              <p className={cx(label, "mt-3")}>We are wrong if</p><p className="text-[13.5px] text-slate-700">{h.wrong}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-slate-500">Test thresholds are proposed for the pilot, not measured.</p>
      </Section>
    </StoryFrame>
  );
}

// ───────────────────────── 03 Stakeholders ─────────────────────────
const PEOPLE_MAP: { id?: string; who: string; wants: string; worries: string; ava: string; side: "speed" | "control" | "both" }[] = [
  { id: "rahul", who: "Requester", wants: "Get the supplier started fast.", worries: "Being blamed for a slow or wrong request.", ava: "Writes normal email. Answers one Yes/No. Gets drafts to send.", side: "speed" },
  { who: "Supplier", wants: "Start work and get paid on time.", worries: "Changing scope and slow approvals.", ava: "Hears \"no start before a PO\" on day one, sees only what we asked for in a portal, and replies by email or upload. Never sees flags or limits.", side: "speed" },
  { id: "ananya", who: "Approvers", wants: "Approve once, on the right facts.", worries: "Signing off on numbers that later change.", ava: "Decision Receipts that reopen when facts change.", side: "both" },
  { id: "karan", who: "Procurement", wants: "Complete, correctly routed requests and fair prices.", worries: "Spend over limits found after commitment.", ava: "Owns every request; sees 90-day spend from the first email.", side: "control" },
  { id: "suresh", who: "Finance", wants: "Spend within budget; invoices that match.", worries: "Invoices with no approval behind them.", ava: "Invoices are linked to requests; early starts are recorded.", side: "control" },
  { id: "meera", who: "InfoSec and Privacy", wants: "Know who touches customer data.", worries: "Finding out after work starts.", ava: "Data access spotted in attachments; certificates checked by date.", side: "control" },
  { id: "farah", who: "Legal", wants: "Requests that arrive complete.", worries: "Chasing basics instead of reviewing terms.", ava: "A handoff packet with confirmed facts and open notes.", side: "control" },
  { who: "Employees", wants: "Mail read only for its purpose.", worries: "Surveillance.", ava: "Only supplier domains; employees can see what Ava captured.", side: "both" },
];
const CLASHES = [
  { a: "Requester", b: "Procurement", tension: "“Start Monday” against “get a competing quote”.", fix: "The 90-day total is computed from the first email, so an exception is recorded on day 1, not found later.", demo: ["A", 2] as const },
  { a: "Requester", b: "InfoSec", tension: "The request doesn't mention data; InfoSec must know.", fix: "Ava finds admin access in the supplier's PDF and asks one Yes/No.", demo: ["A", 3] as const },
  { a: "Approvers", b: "Finance", tension: "Approve once against prices that change.", fix: "Receipts reopen when a material fact changes, and handoff stops.", demo: ["A", 7] as const },
  { a: "Business", b: "Legal", tension: "Fewer reviews against reviewing everything.", fix: "Repeat work under an existing agreement goes straight to PO.", demo: null },
  { a: "Employees", b: "Company", tension: "Privacy against capture.", fix: "Scope is limited to supplier domains, with exclusions and visibility.", demo: null },
  { a: "Supplier", b: "Procurement", tension: "The supplier wants to start; we need a PO first.", fix: "Ask Ava sends the supplier a routine first message that says no work starts before a PO, so the early start never happens.", demo: null, href: "/new" },
  { a: "Requesters", b: "Procurement", tension: "Requesters want chasers gone; Procurement wants to control what leaves the building.", fix: "Autonomy is per kind of message, off by default except quote requests, logged, and never covers a decision.", demo: null, href: "/settings" },
];
const RIPPLES = [
  { cause: "Rahul answers Yes: the supplier will access customer data", effects: ["Meera (InfoSec) gets an approval item", "Farah (Legal) gets the DPA", "Rahul gets a draft asking for certificates"], demo: ["A", 4] as const },
  { cause: "The supplier's PDF raises the price by ₹1.5L", effects: ["Ananya's and Vikram's receipts reopen", "Karan's request shows a blocked banner", "The change appears in the Changes feed"], demo: ["A", 7] as const },
  { cause: "A requester starts in Ask Ava", effects: ["Ava sends the supplier a routine first message: proposal wanted, no start before a PO", "Karan sees the request, the 90-day total and any duplicate", "Approvers are asked only once the written quote confirms the amount"], demo: null, href: "/new" },
  { cause: "The supplier replies in the portal with a certificate", effects: ["The reply is read like any email on the thread", "Meera's InfoSec item and the plan update", "Rahul sees what changed without chasing anyone"], demo: null, href: "/requests/REQ-1047" },
  { cause: "The last check passes", effects: ["The request becomes Ready for Legal Review", "Farah receives the handoff packet", "The dashboard records 3 business days"], demo: ["A", 9] as const },
];

export function Stakeholders() {
  const setViewAs = useAva((s) => s.setViewAs); const router = useRouter();
  const lane = (side: "speed" | "both" | "control") => PEOPLE_MAP.filter((p) => p.side === side);
  return (
    <StoryFrame slug="stakeholders" answer="The central conflict is speed against control. Ava makes the controlled path the fastest one.">
      <Section title="The tension" sub="Who pulls which way. Approvers and employees sit in the middle.">
        <div className={cx(card, "p-4")}>
          <div className="grid gap-3 md:grid-cols-3">
            {(["speed", "both", "control"] as const).map((side) => (
              <div key={side} className={cx("rounded-lg p-3", side === "speed" ? "bg-amber-50" : side === "control" ? "bg-accent-50" : "bg-slate-50")}>
                <p className={cx(label, side === "speed" ? "text-amber-800" : side === "control" ? "text-accent-700" : "")}>{side === "speed" ? "Wants speed" : side === "control" ? "Wants control" : "Needs both"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{lane(side).map((p) => <span key={p.who} className="rounded-full bg-white px-2.5 py-1 text-[13px] font-medium ring-1 ring-slate-200">{p.who}</span>)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[13.5px] text-slate-700"><Icon name="spark" className="shrink-0 text-accent" />Ava removes the trade-off: the controlled path asks less of people than going around it.</div>
        </div>
      </Section>

      <Section title="What each stakeholder wants, worries about, and gets">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PEOPLE_MAP.map((p) => (
            <div key={p.who} className={cx(card, "flex flex-col p-4")}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-100 text-[12px] font-semibold text-accent-700">{p.id ? initials(p.id) : p.who[0]}</span>
                <span className="leading-tight"><span className="block text-[14.5px] font-semibold">{p.who}</span>{p.id && <span className="text-[12px] text-slate-500">{person(p.id)?.name}</span>}</span>
              </div>
              <dl className="mt-3 flex-1 space-y-2 text-[13px]">
                <div><dt className={label}>Wants</dt><dd className="text-slate-800">{p.wants}</dd></div>
                <div><dt className={label}>Worries</dt><dd className="text-slate-800">{p.worries}</dd></div>
                <div><dt className={cx(label, "text-emerald-700")}>Ava gives them</dt><dd className="text-slate-800">{p.ava}</dd></div>
              </dl>
              {p.id && <button onClick={() => { setViewAs(p.id!); router.push("/today"); }} className="mt-3 text-left text-[12.5px] font-medium text-accent hover:underline">See {person(p.id)?.name.split(" ")[0]}&apos;s screen →</button>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Where interests conflict, and how Ava settles each one">
        <div className={cx(card, "divide-y divide-slate-100")}>
          {CLASHES.map((c) => (
            <div key={c.a + c.b} className="grid gap-2 px-4 py-3.5 md:grid-cols-[220px_1fr_1.2fr_auto] md:items-center md:gap-4">
              <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold"><span className="rounded-full bg-amber-50 px-2 py-0.5 ring-1 ring-amber-200">{c.a}</span><span className="text-slate-400">vs</span><span className="rounded-full bg-accent-50 px-2 py-0.5 ring-1 ring-accent-100">{c.b}</span></span>
              <span className="text-[13.5px] text-slate-600">{c.tension}</span>
              <span className="text-[13.5px] text-slate-900">{c.fix}</span>
              {c.demo ? <DemoLink sc={c.demo[0]} step={c.demo[1]}>Step {c.demo[1]}</DemoLink> : (c as { href?: string }).href ? <Link href={(c as { href?: string }).href!} className="text-[12.5px] font-medium text-accent hover:underline">Try it →</Link> : <span />}
            </div>
          ))}
        </div>
      </Section>

      <Section title="How their experiences connect" sub="One action by one person changes several other people's screens at once. In the app, every action shows a “What this reached” panel naming each person whose queue changed, and a window opened as someone else updates live.">
        <div className="grid gap-3 lg:grid-cols-3">
          {RIPPLES.map((r) => (
            <div key={r.cause} className={cx(card, "p-4")}>
              <p className={label}>When</p>
              <p className="mt-1 text-[14.5px] font-semibold">{r.cause}</p>
              <p className={cx(label, "mt-3")}>Then</p>
              <ul className="mt-1 space-y-1.5">{r.effects.map((e) => <li key={e} className="flex gap-2 text-[13.5px] text-slate-700"><Icon name="arrowRight" className="mt-0.5 shrink-0 text-accent" />{e}</li>)}</ul>
              <div className="mt-3">{r.demo ? <DemoLink sc={r.demo[0]} step={r.demo[1]} /> : <Link href={(r as { href?: string }).href ?? "/"} className="text-[12.5px] font-medium text-accent hover:underline">Try it →</Link>}</div>
            </div>
          ))}
        </div>
      </Section>
    </StoryFrame>
  );
}

// ───────────────────────── 04 Metrics ─────────────────────────
const hrs = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h / 24 * 10) / 10} days`);

export function Metrics() {
  const state = useAva((s) => s.state);
  const n = northStar(state);
  const BASELINE: { m: string; today: string; how: string; target: string }[] = [
    { m: "Prayaan-only time per request", today: "Measure in week 1", how: "Sample 50 requests closed in the last 60 days. From the mailbox, time from first email to a complete handoff, minus every stretch spent waiting on the supplier.", target: "At least 30% lower, and under 1 day for fast-lane requests" },
    { m: "Touches per request", today: "Measure in week 1", how: "Count the people who emailed, forwarded or approved for each sampled request.", target: "Falls every month; routine messages move to Ava" },
    { m: "Clean first pass", today: "Measure in week 1", how: "Share of those requests where Legal or Finance had to ask for something that was missing, or an approval was found stale.", target: "Above 90%" },
    { m: "Requests that never reached anyone", today: "Estimate from invoices", how: "Invoices from suppliers with no matching request in the last 90 days.", target: "Falls toward zero; each one becomes a request" },
  ];
  const TRIP = [
    { what: "Fewer than half of new requests start in Ask Ava or are caught from email", limit: "after 8 weeks", then: "People are routing around us. Rework the front door before adding anything." },
    { what: "Filing accuracy (right supplier, project, request)", limit: "below 90% after 4 weeks", then: "Ask the requester to confirm the filing; do not trust it silently." },
    { what: "Ava's recommendations are dismissed", limit: "more than half the time, for any type", then: "Stop showing that type; read the dismiss reasons first." },
    { what: "A routine message Ava sent causes a supplier complaint or a wrong commitment", limit: "even once", then: "Drop that message type back to draft only." },
    { what: "Reviewers override routing", limit: "on more than 20% of requests", then: "The rules are wrong for this company. Fix the rules, not the model." },
    { what: "Fewer than 1 in 20 requests show undisclosed data access", limit: "in the pilot sample", then: "Hypothesis 1 is wrong. Focus on speed, not on catching hidden scope." },
    { what: "Prayaan-only time has not fallen by 30%", limit: "after 6 weeks", then: "Stop. Intake was not the bottleneck." },
    { what: "Employees object to Ava reading supplier mail", limit: "at any scale", then: "Pause the mail rule; keep Ask Ava only." },
  ];
  const DRIVERS: { m: string; tells: string; live?: string; where?: string }[] = [
    { m: "Touches per request", tells: "People decisions per request. Lower means Ava does more of the legwork.", live: n.total ? `${n.touches.toFixed(1)} per request` : undefined, where: "/dashboard" },
    { m: "Rework avoided", tells: "Approvals that would have been wrong because a fact rose after sign-off.", live: `${n.reopened} reopened`, where: "/dashboard" },
    { m: "Clean first pass", tells: "Ready packets that were never withdrawn.", live: n.ready ? `${n.cleanReady} of ${n.ready}` : undefined, where: "/requests" },
    { m: "Started before the supplier", tells: "Requests that began in Ask Ava, so the supplier hears “no start before a PO” on day one.", live: `${n.fromAsk} of ${n.total}`, where: "/new" },
    { m: "Routine messages Ava sent", tells: "Quote requests and chasers sent under the autonomy settings.", live: `${n.autoSent} sent`, where: "/settings" },
    { m: "Filing accuracy", tells: "Emails filed to the right supplier, project and request." },
  ];
  const sup = n.supplier, own = n.own, tot = sup + own || 1;
  return (
    <StoryFrame slug="metrics" answer="One number: of the requests that reach Legal or a PO, how many arrive complete and correct with Prayaan's own time under a day.">
      <Section title="North star">
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className={cx(card, "p-5")}>
            <p className="border-b-2 border-slate-900 pb-2 text-[15px] font-semibold">Requests that reach Ready for Legal Review or Ready to issue PO complete, correctly routed and never withdrawn, with Prayaan&apos;s own time under 1 day</p>
            <p className="pt-2 text-[15px] text-slate-700">All in-scope requests, counted from the mailbox and Ask Ava, not from the tool</p>
            <p className="mt-3 rounded-md bg-slate-50 p-3 text-[13px] text-slate-700"><b>Prayaan&apos;s own time</b> is the hours from the first message to a complete handoff when nobody was waiting on the supplier. A supplier who takes five days to send a certificate does not count against us, and does not hide a slow approver either.</p>
            <ul className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-[13px] text-slate-700 sm:grid-cols-3">
              <li><b className="block text-slate-900">Counts missed requests</b>The denominator comes from email, not from the tool.</li>
              <li><b className="block text-slate-900">Punishes rework</b>A withdrawn handoff or a stale approval does not count.</li>
              <li><b className="block text-slate-900">Fair on speed</b>We are only measured on the time we control.</li>
            </ul>
          </div>
          <div className="flex flex-col justify-between rounded-xl bg-ink p-5 text-white">
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-white/60">Live in this session</p>
            <p className="mt-2 font-mono text-[44px] font-medium leading-none">{n.good}<span className="text-white/50"> / {n.total}</span></p>
            <p className="mt-2 text-[13.5px] text-white/80">{n.total ? `requests are clean and fast. ${n.total - n.ready} still open.` : "No requests yet. Start the guided demo."}</p>
            <Link href="/dashboard" className="mt-3 text-[13px] font-medium text-white underline">Open the dashboard →</Link>
          </div>
        </div>
      </Section>

      <Section title="Where the time goes" sub="Finished requests, split by who was holding them. This is why the target is Prayaan's time, not the calendar. Open requests are listed with their time so far.">
        {n.rows.length ? (
          <div className={cx(card, "p-4")}>
            {n.ready === 0 && <p className="mb-2 text-[13px] text-slate-600">No request has finished yet, so there is no split. Open requests show their time so far.</p>}
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Supplier ${hrs(sup)}, Prayaan ${hrs(own)}`}>
              <div className="bg-amber-400" style={{ width: `${(sup / tot) * 100}%` }} /><div className="bg-accent" style={{ width: `${Math.max(1.5, (own / tot) * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />Waiting on suppliers: <b>{hrs(sup)}</b></span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />Prayaan only: <b>{hrs(own)}</b></span></div>
            <ul className="mt-3 divide-y divide-slate-100 text-[13px]">{n.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 py-2"><Link className="font-mono text-accent hover:underline" href={`/requests/${r.id}`}>{r.id}</Link><span className="text-slate-600">{state.requests[r.id].title}</span><span className="ml-auto text-slate-700">supplier {hrs(r.supplier)} · Prayaan {hrs(r.own)}</span>{r.good ? <span className="rounded bg-emerald-50 px-1.5 text-[11.5px] font-semibold text-emerald-800">counts</span> : <span className="rounded bg-slate-100 px-1.5 text-[11.5px] font-semibold text-slate-600">{r.ready ? "withdrawn or slow" : "open"}</span>}</li>))}</ul>
            <p className="mt-3 text-[12.5px] text-slate-500">Limit of this measure: it is a critical-path view. If an approver sits on a request while the supplier is also late, the approver&apos;s wait is hidden behind the supplier&apos;s. The touches metric below covers people&apos;s effort.</p>
          </div>
        ) : <p className={cx(card, "p-4 text-[13.5px] text-slate-600")}>No requests yet. <DemoLink sc="A" step={9}>Run Scenario A to the end</DemoLink> to see the split.</p>}
      </Section>

      <Section title="How we'll know it works" sub="Drivers of the north star. Live ones come from this session; the rest are measured in the pilot.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DRIVERS.map((s) => (
            <div key={s.m} className={cx(card, "p-4")}>
              <h3 className="text-[14.5px] font-semibold">{s.m}</h3>
              <p className="mt-1 text-[13.5px] text-slate-600">{s.tells}</p>
              {s.live && s.where ? <Link href={s.where} className="mt-2 inline-block rounded bg-emerald-50 px-2 py-0.5 font-mono text-[12px] text-emerald-800 ring-1 ring-emerald-200">Live: {s.live}</Link> : <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">Measured in the pilot</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-slate-600">Not on this list on purpose: how many actions Ava took. It rises when Ava checks more things, not when anyone is better off, so the dashboard shows it small and says so.</p>
        <div className={cx(card, "mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 p-4")}>
          <span className={label}>Long-term business result</span>
          <span className="text-[15px] font-semibold">Governed Spend Coverage</span>
          <span className="text-[13.5px] text-slate-600">= supplier spend that went through a complete, approved request ÷ all supplier spend.</span>
        </div>
      </Section>

      <Section title="Baseline and pilot" sub="We have no internal numbers, so none are claimed. Week 1 of the pilot produces the baseline; everything after is compared to it.">
        <div className={cx(card, "overflow-x-auto")}>
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead><tr className="border-b border-slate-200 text-[11.5px] uppercase tracking-[0.05em] text-slate-500"><th className="p-3">Measure</th><th className="p-3">Today</th><th className="p-3">How we get it</th><th className="p-3">Pilot target</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{BASELINE.map((r) => <tr key={r.m} className="align-top"><td className="p-3 font-medium">{r.m}</td><td className="p-3 text-slate-600">{r.today}</td><td className="p-3 text-slate-700">{r.how}</td><td className="p-3">{r.target}</td></tr>)}</tbody>
          </table>
        </div>
        <ul className="mt-3 grid gap-2 text-[13.5px] text-slate-700 md:grid-cols-3">
          <li className={cx(card, "p-3.5")}><b className="block text-slate-900">Shadow first, 4 weeks</b>Ava reads and drafts but nothing is sent. We compare her routing with what Procurement actually did.</li>
          <li className={cx(card, "p-3.5")}><b className="block text-slate-900">Then two cost centres</b>Sales Ops and Marketing Ops, with Ask Ava and routine sends on. The others are the control group.</li>
          <li className={cx(card, "p-3.5")}><b className="block text-slate-900">Sizing, as an assumption</b>About 200 requests a month at 15 to 30 minutes of intake each (a vendor figure) is 50 to 100 hours a month before review begins. We check it in week 1.</li>
        </ul>
      </Section>

      <Section title="When we would rethink the approach" sub="Agreed before the pilot starts. Each has a threshold and a predefined response.">
        <ul className="grid gap-2 md:grid-cols-2">
          {TRIP.map((t) => (
            <li key={t.what} className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/50 p-3.5">
              <Icon name="alert" className="mt-0.5 shrink-0 text-red-700" />
              <span className="text-[14px]"><b className="text-slate-900">{t.what}</b> <span className="text-red-800">{t.limit}.</span><span className="mt-0.5 block text-[13px] text-slate-700">Then: {t.then}</span></span>
            </li>
          ))}
        </ul>
      </Section>
    </StoryFrame>
  );
}

// ───────────────────────── 05 Assumptions ─────────────────────────
const GROUPS: { title: string; icon: IconName; items: { a: string; ifWrong: string }[] }[] = [
  { title: "The company", icon: "building", items: [
    { a: "3,000 employees, about 2,500 suppliers, about 200 contract requests a month.", ifWrong: "Changes how many requests Procurement handles, not the design." },
    { a: "Procurement owns each request until handoff.", ifWrong: "Ownership moves to Legal ops; conflict cards route to them." },
  ] },
  { title: "Systems", icon: "settings", items: [
    { a: "Microsoft 365 or Google Workspace mail access, approved by IT and Legal, through their standard mail-access interfaces.", ifWrong: "Fall back to copying contracts@ on supplier email." },
    { a: "The supplier list lives in the ERP.", ifWrong: "More email lands in Procurement's Unsorted tray." },
    { a: "Slack or Teams for notifications.", ifWrong: "Notifications go by email instead." },
  ] },
  { title: "How much Ava does", icon: "spark", items: [
    { a: "Ava may send a routine message (a quote request, a document chaser) only when that message type is switched on. Quote requests are on by default; chasers are off.", ifWrong: "Switch the type off; it falls back to a draft for the requester. Any supplier complaint or wrong commitment from an auto-sent message turns that type off for good." },
    { a: "Ava never approves, rejects, accepts a price, resolves a dispute or changes a term. Those stay with named people.", ifWrong: "Not negotiable: the Decision Receipt exists so a person is accountable." },
    { a: "Employees will start in Ask Ava or just email the supplier, and Ava catches the email either way.", ifWrong: "If fewer than half of new requests start in Ask Ava or are caught from mail within 8 weeks, the front door is rebuilt before anything else is added." },
  ] },
  { title: "People and privacy", icon: "shield", items: [
    { a: "Email with suppliers is business correspondence, and employees are told Ava exists.", ifWrong: "The pilot cannot start until a consent model is agreed." },
    { a: "HR, Board and outside-counsel mail is excluded.", ifWrong: "Scope rules are tightened before launch." },
  ] },
  { title: "This prototype", icon: "eye", items: [
    { a: "Email, ERP and e-signature are simulated. Data is fictional.", ifWrong: "Not applicable: this is a demonstration." },
    { a: "All state is the event log, saved in this browser and shared by every window of it. Open two windows as different people and they update each other. A real deployment stores the same log in a database.", ifWrong: "Two people on two computers would not see each other yet. That is the first production task, and the engine does not change." },
    { a: "The signed contracts Ava checks against were entered by hand. A real deployment extracts the clauses from the repository and Legal confirms them once.", ifWrong: "Without a repository the contract checks do not run; intake, routing and approvals still do." },
    { a: "Extraction: live AI when a key is set, cached AI results for scripted emails, a rules-based extractor otherwise. Policy is plain code in every case.", ifWrong: "Not applicable: the outcome is the same either way." },
  ] },
];
const POLICY_ROWS = [
  ["Approval limit", "Above ₹25,00,000 needs VP approval", "Budget owner approval is always required"],
  ["How spend is counted", "Before GST, per supplier and cost centre", "Rolling 90 days"],
  ["Competing quote", "Over the limit: a competing quote or an authorized exception", "The exception needs VP approval"],
  ["Data access", "InfoSec approval and a DPA", "The DPA is assigned to Legal review"],
  ["Material facts", "Amount, scope, data access, term, supplier entity", "A change reopens approvals that depended on it"],
];
export function Assumptions() {
  return (
    <StoryFrame slug="assumptions" answer="Everything we assumed, and what changes if an assumption is wrong.">
      <Section title="Policy the prototype enforces" sub="Written as code, not AI. Each rule shows on the request page with its numbers.">
        <div className={cx(card, "overflow-x-auto")}>
          <table className="w-full min-w-[560px] text-[13.5px]">
            <thead><tr className="border-b border-slate-100 text-left"><th className={cx(label, "px-4 py-2")}>Rule</th><th className={cx(label, "px-4 py-2")}>What it requires</th><th className={cx(label, "px-4 py-2")}>Detail</th></tr></thead>
            <tbody>{POLICY_ROWS.map((r) => <tr key={r[0]} className="border-b border-slate-50"><td className="px-4 py-2.5 font-semibold">{r[0]}</td><td className="px-4 py-2.5">{r[1]}</td><td className="px-4 py-2.5 text-slate-600">{r[2]}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
      <Section title="How Ava connects" sub="Where email comes from, and where AI and code each act."><ConnectDiagram /></Section>
      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className={cx(card, "divide-y divide-slate-100")}>
            <div className="hidden grid-cols-[1.3fr_1fr] gap-4 px-4 py-2 md:grid"><span className={label}>We assume</span><span className={label}>If this is wrong</span></div>
            {g.items.map((it) => (
              <div key={it.a} className="grid gap-1 px-4 py-3 md:grid-cols-[1.3fr_1fr] md:gap-4">
                <p className="flex gap-2.5 text-[14px] text-slate-900"><Icon name={g.icon} className="mt-0.5 shrink-0 text-slate-400" />{it.a}</p>
                <p className="text-[13.5px] text-slate-600"><span className="md:hidden font-semibold">If wrong: </span>{it.ifWrong}</p>
              </div>
            ))}
          </div>
        </Section>
      ))}
      <Section title="Out of scope on purpose">
        <div className="flex flex-wrap gap-2">{["Real mailbox connection", "Real ERP or e-signature", "Clause review or redlining", "Post-signature monitoring", "A supplier portal", "User accounts"].map((x) => <span key={x} className="rounded-full bg-slate-100 px-3 py-1 text-[13px] text-slate-700">{x}</span>)}</div>
      </Section>
    </StoryFrame>
  );
}

// ───────────────────────── 06 Ava and Sirion ─────────────────────────
type Cell = { v: "yes" | "no" | "na" | "partial"; t: string };
const MATRIX: { cap: string; form: Cell; sirion: Cell; ava: Cell }[] = [
  { cap: "Where a request starts", form: { v: "partial", t: "Someone fills in a form" }, sirion: { v: "yes", t: "Self-service intake" }, ava: { v: "yes", t: "The supplier email people already send" } },
  { cap: "Reads quotes, order forms and certificates before a contract exists", form: { v: "no", t: "Uploads are stored, not read" }, sirion: { v: "partial", t: "Extraction Agent reads contracts and related documents" }, ava: { v: "yes", t: "Facts with the exact line, and versions compared" } },
  { cap: "Files by supplier › project › request automatically", form: { v: "no", t: "The requester picks" }, sirion: { v: "na", t: "Not shown in public material" }, ava: { v: "yes", t: "From thread, references and names" } },
  { cap: "Approvals reopen when a material fact changes", form: { v: "no", t: "An approval is final" }, sirion: { v: "na", t: "Not shown in public material" }, ava: { v: "yes", t: "Decision Receipts tied to facts" } },
  { cap: "Drafting, issue detection and redlining", form: { v: "no", t: "" }, sirion: { v: "yes", t: "Draft, Issue Detection and Redline Agents" }, ava: { v: "no", t: "Out of scope: hands off to Legal" } },
  { cap: "Obligations, SLAs and invoice reconciliation after signature", form: { v: "no", t: "" }, sirion: { v: "yes", t: "Obligation and Invoice Agents" }, ava: { v: "no", t: "Out of scope" } },
];
function CellView({ c }: { c: Cell }) {
  const m = { yes: ["bg-emerald-600 text-white", "✓"], partial: ["bg-amber-100 text-amber-800", "~"], no: ["bg-slate-200 text-slate-500", "–"], na: ["bg-slate-100 text-slate-400", "?"] }[c.v];
  return <div className="flex items-start gap-2"><span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", m[0])} aria-hidden>{m[1]}</span><span className="text-[13px] text-slate-700">{c.t || (c.v === "no" ? "No" : "")}</span></div>;
}
export function Sirion() {
  return (
    <StoryFrame slug="sirion" answer="Ava is the front door before a contract exists. Her handoff packet feeds any contract system, including Sirion's agents.">
      <Section title="How they fit together">
        <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1.2fr_auto_1fr]">
          <div className={cx(card, "p-4")}><p className={label}>In</p><p className="mt-1 font-semibold">Supplier email and attachments</p><p className="text-[13px] text-slate-600">Quotes, rate cards, order forms, certificates, invoices.</p></div>
          <Icon name="arrowRight" className="mx-auto hidden self-center text-slate-400 md:block" />
          <div className="rounded-xl border-2 border-accent bg-accent-50 p-4"><p className={cx(label, "text-accent-700")}>Ava · intake</p><p className="mt-1 font-semibold">Capture, file, check, route, approve</p><p className="text-[13px] text-slate-700">Ends in a handoff packet: confirmed facts with sources, signed receipts, exceptions, open notes.</p></div>
          <Icon name="arrowRight" className="mx-auto hidden self-center text-slate-400 md:block" />
          <div className={cx(card, "p-4")}><p className={label}>Then · any contract system</p><p className="mt-1 font-semibold">Sirion&apos;s agents</p><p className="text-[13px] text-slate-600">Drafting, redlining, obligations, and invoices checked against the agreed terms.</p></div>
        </div>
      </Section>
      <Section title="Side by side" sub="Sirion's column uses public material only. “Not shown” means we did not find it publicly, not that it is missing.">
        <div className={cx(card, "overflow-x-auto")}>
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-slate-200 text-left">
              <th className={cx(label, "w-[28%] px-4 py-3")}>Capability</th><th className={cx(label, "px-4 py-3")}>Typical form-based intake</th><th className={cx(label, "px-4 py-3")}>Sirion (public material)</th><th className={cx(label, "bg-accent-50 px-4 py-3 text-accent-700")}>Ava</th>
            </tr></thead>
            <tbody>{MATRIX.map((r) => (
              <tr key={r.cap} className="border-b border-slate-100 align-top">
                <td className="px-4 py-3 text-[13.5px] font-semibold">{r.cap}</td>
                <td className="px-4 py-3"><CellView c={r.form} /></td><td className="px-4 py-3"><CellView c={r.sirion} /></td><td className="bg-accent-50/50 px-4 py-3"><CellView c={r.ava} /></td>
              </tr>))}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[12.5px] text-slate-500">Sources: <Ext href="https://www.legaltechnologyhub.com/vendors/sirion-clm-by-sirion/">Legaltech Hub profile</Ext> · <Ext href="https://www.getapp.com/operations-management-software/a/sirionone">GetApp profile</Ext> · <Ext href="https://marketplace.microsoft.com/en-us/product/web-apps/sirionlabsinc1658837034847.sirionlabs">Microsoft Marketplace listing</Ext></p>
      </Section>
      <Section title="Different from a typical intake tool">
        <ul className="grid gap-3 sm:grid-cols-3">
          {["No form, no portal, no forwarding.", "Ava reads attachments, not just email text.", "An approval belongs to the facts it was given for."].map((t) => <li key={t} className={cx(card, "flex gap-2 p-4 text-[14px] font-medium")}><Icon name="check" className="mt-0.5 shrink-0 text-emerald-600" />{t}</li>)}
        </ul>
      </Section>
      <Section title="What Ava adds in four lines">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Nothing to submit", "She records supplier email and attachments without anyone filling anything in.", ["A", 1]], ["Files early", "Supplier › project › request, before a contract exists.", ["A", 1]], ["Reads the paperwork", "Quotes, rate cards and certificates, line by line.", ["A", 3]], ["Approvals follow facts", "A changed fact reopens the approvals that depended on it.", ["A", 7]]].map(([t, d, demo], i) => (
            <li key={t as string} className={cx(card, "flex flex-col p-4")}><span className="font-mono text-[12px] text-slate-400">0{i + 1}</span><h3 className="mt-1 text-[15px] font-semibold">{t as string}</h3><p className="mt-1 flex-1 text-[13.5px] text-slate-600">{d as string}</p><div className="mt-3"><DemoLink sc={(demo as any)[0]} step={(demo as any)[1]} /></div></li>
          ))}
        </ol>
      </Section>
    </StoryFrame>
  );
}
