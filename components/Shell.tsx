"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAva, STEPS } from "@/lib/store";
import { resolveFocus } from "@/lib/story";
import { deriveItems } from "@/lib/engine/items";
import { fmtDT } from "@/lib/format";
import { personName } from "@/lib/engine/world";
import { Button, cx } from "./ui";
import SourceViewer from "./SourceViewer";

export const VIEW_AS: { id: string; label: string }[] = [
  { id: "rahul", label: "Rahul Mehta (requester)" }, { id: "neha", label: "Neha Kapoor (requester)" }, { id: "suresh", label: "Suresh Pillai (requester, Finance)" },
  { id: "karan", label: "Karan Shah (Procurement, request owner)" }, { id: "meera", label: "Meera Nair (InfoSec)" }, { id: "farah", label: "Farah Khan (Legal)" },
  { id: "ananya", label: "Ananya Iyer (budget owner)" }, { id: "deepa", label: "Deepa Menon (budget owner)" }, { id: "ritu", label: "Ritu Bansal (budget owner, Marketing)" }, { id: "vikram", label: "Vikram Rao (VP)" },
];

const PRODUCT = [["/inbox", "Inbox"], ["/dashboard", "Dashboard"], ["/items", "My items"], ["/requests", "Requests"], ["/suppliers", "Suppliers"], ["/conflicts", "Conflicts"]];
const STORY = [["/", "In one minute"], ["/story/why", "Why intake"], ["/story/problem", "The problem"], ["/story/stakeholders", "Stakeholders"], ["/story/metrics", "Metrics"], ["/story/assumptions", "Assumptions"], ["/story/sirion", "Ava and Sirion"]];

export default function Shell({ children }: { children: ReactNode }) {
  const hydrate = useAva((s) => s.hydrate);
  const hydrated = useAva((s) => s.hydrated);
  const setAi = useAva((s) => s.setAi);
  useEffect(() => { hydrate(); fetch("/api/ava").then((r) => r.json()).then((d) => setAi(!!d.ai)).catch(() => setAi(false)); }, [hydrate, setAi]);
  const path = usePathname();
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-2.5">
          <Link href="/" className="flex items-center gap-2" aria-label="Ava home">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-[13px] font-bold text-white">A</span>
            <span className="text-[15px] font-semibold">Ava</span>
            <span className="hidden text-[12px] text-slate-500 lg:inline">contract intake, Prayaan Software</span>
          </Link>
          <nav aria-label="Product" className="ml-2 flex flex-wrap items-center gap-0.5">
            {PRODUCT.map(([href, label]) => <NavLink key={href} href={href} active={path.startsWith(href)}>{label}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {hydrated && <ViewAs />}
            {hydrated && <Bell />}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-5 pb-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Story</span>
          {STORY.map(([href, label]) => <NavLink key={href} href={href} small active={href === "/" ? path === "/" : path.startsWith(href)}>{label}</NavLink>)}
          <span className="mx-2 h-4 w-px bg-slate-200" />
          <NavLink href="/settings" small active={path.startsWith("/settings")}>Settings</NavLink>
        </div>
        {hydrated && <StoryBar />}
      </header>
      <main id="main" className="mx-auto max-w-[1400px] px-5 py-6">
        {hydrated ? children : <div className="py-20 text-center text-slate-500">Loading the event log…</div>}
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-[12px] text-slate-500">
        All companies, people, emails, documents and amounts in this prototype are fictional. Email, ERP and e-signature are simulated.
      </footer>
      <SourceViewer />
    </div>
  );
}

function NavLink({ href, active, children, small }: { href: string; active?: boolean; children: ReactNode; small?: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={cx("rounded-md px-2.5 whitespace-nowrap", small ? "py-0.5 text-[12.5px]" : "py-1.5 text-[13.5px]", active ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>{children}</Link>;
}

function ViewAs() {
  const viewAs = useAva((s) => s.viewAs); const setViewAs = useAva((s) => s.setViewAs);
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
      <span className="hidden sm:inline">View as</span>
      <select aria-label="View as" value={viewAs} onChange={(e) => setViewAs(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[13px] font-medium text-slate-900">
        {VIEW_AS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </label>
  );
}

function Bell() {
  const state = useAva((s) => s.state); const viewAs = useAva((s) => s.viewAs);
  const n = useMemo(() => deriveItems(state).filter((i) => i.personId === viewAs).length, [state, viewAs]);
  return (
    <Link href="/items" aria-label={`${n} items waiting on ${personName(viewAs)}`} className="relative rounded-md border border-slate-300 px-2 py-1 text-[13px] hover:bg-slate-50">
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
      {n > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{n}</span>}
    </Link>
  );
}

function StoryBar() {
  const router = useRouter();
  const { scenario, pos, caption, state, next, prev, reset, setScenario, runContrast, tick } = useAva();
  const steps = STEPS[scenario]; const i = pos[scenario];
  const [confirmReset, setConfirmReset] = useState(false);
  const go = (f?: string) => { if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  return (
    <div className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2">
        <div role="tablist" aria-label="Scenario" className="flex rounded-md border border-slate-300 bg-white p-0.5 text-[12.5px]">
          {(["A", "B"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={scenario === s} onClick={() => setScenario(s)} className={cx("rounded px-2.5 py-1", scenario === s ? "bg-accent text-white" : "text-slate-700 hover:bg-slate-100")}>
              {s === "A" ? "Scenario A: new project (Trivenika)" : "Scenario B: renewal (Kosha)"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button small onClick={prev} disabled={i === 0} title="Replay the event log up to the previous step">Previous</Button>
          <Button small variant="primary" onClick={() => go(next())} disabled={i >= steps.length}>{i === 0 ? "Start" : i >= steps.length ? "Done" : "Next step"}</Button>
          {confirmReset ? (
            <span className="flex items-center gap-1 text-[12px]">Clear all work? <Button small variant="danger" onClick={() => { reset(); setConfirmReset(false); router.push("/inbox"); }}>Reset</Button><Button small variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button></span>
          ) : <Button small variant="ghost" onClick={() => setConfirmReset(true)}>Reset</Button>}
        </div>
        <ol aria-label="Steps" className="flex items-center gap-1">
          {steps.map((s, k) => (
            <li key={s.id} title={`${s.label}: ${s.caption}`} className={cx("h-2 w-6 rounded-full", k < i ? "bg-accent" : k === i ? "bg-accent/30 ring-1 ring-accent" : "bg-slate-300")}><span className="sr-only">{s.label}{k < i ? " (done)" : ""}</span></li>
          ))}
        </ol>
        <span className="text-[12.5px] text-slate-500 tabular">{i}/{steps.length}</span>
        <p className="min-w-[240px] flex-1 text-[13px] font-medium text-slate-800" aria-live="polite">{caption ?? (scenario === "A" ? "Press Start to play Scenario A, or use Inbox > New email to do it by hand." : "Press Next to start the Kosha renewal.")}</p>
        <div className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
          <span className="tabular font-medium" title="Simulated clock">{fmtDT(state.now)}</span>
          <Button small variant="ghost" onClick={() => tick(60)} title="Advance the simulated clock by 1 hour">+1h</Button>
          <Button small variant="ghost" onClick={() => tick(60 * 24)} title="Advance the simulated clock by 1 day">+1d</Button>
          <Button small onClick={() => { runContrast(); router.push("/items"); }}>Show a repeat request</Button>
        </div>
      </div>
    </div>
  );
}
