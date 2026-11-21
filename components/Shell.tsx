"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAva, STEPS } from "@/lib/store";
import { resolveFocus } from "@/lib/story";
import { deriveItems } from "@/lib/engine/items";
import { fmtDT } from "@/lib/format";
import { person } from "@/lib/engine/world";
import { cx } from "./ui";
import { Icon, type IconName } from "./icons";
import SourceViewer from "./SourceViewer";

export const VIEW_AS: { id: string; role: string }[] = [
  { id: "rahul", role: "Requester · Sales Ops" }, { id: "neha", role: "Requester · Marketing Ops" }, { id: "suresh", role: "Requester · Finance" },
  { id: "karan", role: "Procurement · owns every request" }, { id: "meera", role: "InfoSec reviewer" }, { id: "farah", role: "Legal" },
  { id: "ananya", role: "Budget owner · Sales Ops" }, { id: "deepa", role: "Budget owner · Finance" }, { id: "ritu", role: "Budget owner · Marketing" }, { id: "vikram", role: "VP Sales · approves over ₹25L" },
];
export const roleOf = (id: string) => VIEW_AS.find((v) => v.id === id)?.role ?? "";
export const initials = (id: string) => (person(id)?.name ?? id).split(" ").map((w) => w[0]).join("").slice(0, 2);

type NavItem = { href: string; label: string; icon: IconName; count?: (s: ReturnType<typeof useCounts>) => number | undefined; tone?: "red" | "grey" };
const WORK: NavItem[] = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/items", label: "My work", icon: "checkCircle", count: (c) => c.mine, tone: "red" },
  { href: "/inbox", label: "Inbox", icon: "inbox", count: (c) => c.emails, tone: "grey" },
  { href: "/requests", label: "Requests", icon: "list", count: (c) => c.requests, tone: "grey" },
  { href: "/conflicts", label: "Conflicts", icon: "alert", count: (c) => c.conflicts, tone: "red" },
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
  { href: "/suppliers", label: "Suppliers", icon: "building" },
];
const CASE: NavItem[] = [
  { href: "/story/why", label: "Why intake", icon: "book" }, { href: "/story/problem", label: "The problem", icon: "book" },
  { href: "/story/stakeholders", label: "Stakeholders", icon: "users" }, { href: "/story/metrics", label: "Metrics", icon: "chart" },
  { href: "/story/assumptions", label: "Assumptions", icon: "book" }, { href: "/story/sirion", label: "Ava and Sirion", icon: "book" },
];

function useCounts() {
  const state = useAva((s) => s.state); const viewAs = useAva((s) => s.viewAs);
  return useMemo(() => ({
    mine: deriveItems(state).filter((i) => i.personId === viewAs).length,
    emails: state.emails.length,
    requests: state.requestOrder.length,
    conflicts: Object.values(state.conflicts).filter((c) => c.status === "open").length,
  }), [state, viewAs]);
}

export default function Shell({ children }: { children: ReactNode }) {
  const hydrate = useAva((s) => s.hydrate); const hydrated = useAva((s) => s.hydrated); const setAi = useAva((s) => s.setAi);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();
  useEffect(() => { hydrate(); fetch("/api/ava").then((r) => r.json()).then((d) => setAi(!!d.ai)).catch(() => setAi(false)); }, [hydrate, setAi]);
  useEffect(() => { setDrawer(false); }, [path]);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      {/* Sidebar: always visible on large screens, a drawer on small ones */}
      <div className={cx("fixed inset-0 z-40 bg-slate-900/30 lg:hidden", drawer ? "block" : "hidden")} onClick={() => setDrawer(false)} />
      <aside aria-label="Main navigation" className={cx("fixed inset-y-0 left-0 z-50 w-[248px] border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0", drawer ? "translate-x-0" : "-translate-x-full")}>
        {hydrated ? <Sidebar /> : <div className="p-5 text-slate-400">Loading…</div>}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <span className="truncate text-[13px] text-slate-500"><span className="font-medium text-slate-900">Prayaan Software</span> · fictional company · supplier email is simulated</span>
          {hydrated && <TopRight />}
        </header>
        <main id="main" className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 pb-40 sm:px-6">
          {hydrated ? children : <div className="space-y-3"><div className="h-8 w-64 animate-pulse rounded bg-slate-200" /><div className="h-40 animate-pulse rounded-lg bg-slate-100" /></div>}
        </main>
        {hydrated && <DemoDock />}
      </div>
      <SourceViewer />
    </div>
  );
}

function Sidebar() {
  const path = usePathname(); const c = useCounts();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const link = (n: NavItem) => {
    const n2 = n.count?.(c);
    return (
      <li key={n.href}>
        <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cx("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px]", active(n.href) ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
          <Icon name={n.icon} size={17} className={active(n.href) ? "text-accent" : "text-slate-400"} />
          <span className="flex-1">{n.label}</span>
          {!!n2 && <span className={cx("min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular", n.tone === "red" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600")}>{n2}</span>}
        </Link>
      </li>
    );
  };
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-[14px] font-bold text-white">A</span>
        <span className="leading-tight"><span className="block text-[15px] font-semibold">Ava</span><span className="block text-[11.5px] text-slate-500">Contract intake agent</span></span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Workspace</div>
        <ul className="space-y-0.5">{WORK.map(link)}</ul>
        <div className="px-2.5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">About the case</div>
        <ul className="space-y-0.5">{CASE.map(link)}</ul>
        <ul className="mt-4 space-y-0.5">{link({ href: "/settings", label: "Settings", icon: "settings" })}</ul>
      </nav>
      <Persona />
    </div>
  );
}

function Persona() {
  const viewAs = useAva((s) => s.viewAs); const setViewAs = useAva((s) => s.setViewAs);
  const state = useAva((s) => s.state);
  const counts = useMemo(() => { const m: Record<string, number> = {}; deriveItems(state).forEach((i) => { m[i.personId] = (m[i.personId] ?? 0) + 1; }); return m; }, [state]);
  return (
    <div className="border-t border-slate-200 p-3">
      <label htmlFor="viewas" className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Viewing as</label>
      <div className="relative flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 focus-within:border-accent">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-100 text-[12px] font-semibold text-accent-700">{initials(viewAs)}</span>
        <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-semibold">{person(viewAs)?.name}</span><span className="block truncate text-[11.5px] text-slate-500">{roleOf(viewAs)}</span></span>
        <Icon name="chevronDown" className="text-slate-400" />
        <select id="viewas" value={viewAs} onChange={(e) => setViewAs(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Switch person">
          {VIEW_AS.map((v) => <option key={v.id} value={v.id}>{person(v.id)?.name} · {v.role}{counts[v.id] ? ` · ${counts[v.id]} waiting` : ""}</option>)}
        </select>
      </div>
      <p className="mt-1.5 px-1 text-[11.5px] text-slate-500">Switch person to see and do what they can.</p>
    </div>
  );
}

function TopRight() {
  const { state, tick, viewAs } = useAva(); const c = useCounts();
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="relative">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[13px]" title="Simulated clock">
          <Icon name="clock" className="shrink-0 text-slate-400" /><span className="whitespace-nowrap font-mono text-[12.5px]"><span className="hidden sm:inline">{fmtDT(state.now)}</span><span className="sm:hidden">{fmtDT(state.now).split(", ")[1]}</span></span>
        </button>
        {open && <div className="absolute right-0 top-11 z-40 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[13px] shadow-lg" onMouseLeave={() => setOpen(false)}>
          <p className="px-2 pb-1.5 text-slate-500">The clock drives ages, deadlines and the 90-day window.</p>
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => { tick(60); setOpen(false); }}>Move forward 1 hour</button>
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => { tick(60 * 24); setOpen(false); }}>Move forward 1 day</button>
        </div>}
      </div>
      <Link href="/items" aria-label={`${c.mine} items waiting on ${person(viewAs)?.name}`} className="relative grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white">
        <Icon name="bell" />
        {c.mine > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10.5px] font-bold text-white">{c.mine}</span>}
      </Link>
    </div>
  );
}

function DemoDock() {
  const router = useRouter();
  const { scenario, pos, caption, state, next, prev, reset, setScenario, runContrast } = useAva();
  const steps = STEPS[scenario]; const i = pos[scenario];
  const [collapsed, setCollapsed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const cur = i > 0 ? steps[i - 1] : undefined;
  const go = (f?: string) => { if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const done = i >= steps.length;
  if (collapsed) return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30">
      <button onClick={() => setCollapsed(false)} className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-white shadow-lg">
        <Icon name="play" size={14} /> Guided demo · {scenario === "A" ? "Scenario A" : "Scenario B"} · step {i}/{steps.length}
      </button>
    </div>
  );
  return (
    <section aria-label="Guided demo" className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mx-auto max-w-[1320px] px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 whitespace-nowrap text-[12px] text-slate-500">
          <span className="hidden items-center gap-1.5 font-semibold uppercase tracking-[0.05em] sm:flex"><Icon name="play" size={12} />Guided demo</span>
          <div role="tablist" aria-label="Scenario" className="flex rounded-md bg-slate-100 p-0.5 text-[12px]">
            {(["A", "B"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={scenario === s} onClick={() => setScenario(s)} className={cx("rounded px-2 py-0.5", scenario === s ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600")}>
                {s === "A" ? "A · New project" : "B · Renewal"}
              </button>
            ))}
          </div>
          <span className="font-semibold text-slate-700">{i === 0 ? "Not started" : `Step ${i} of ${steps.length}`}</span>
          {cur && <span className="hidden font-mono md:inline">{fmtDT(cur.at)}</span>}
          <ol aria-hidden className="hidden gap-1 lg:flex">{steps.map((s, k) => <li key={s.id} className={cx("h-1.5 w-5 rounded-full", k < i ? "bg-accent" : "bg-slate-200")} />)}</ol>
          <span className="ml-auto flex items-center gap-1">
            <button onClick={() => { runContrast(); router.push("/items"); }} className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-slate-700 hover:bg-slate-100 md:flex" title="A repeat request under an existing agreement: one approval, done in minutes"><Icon name="repeat" size={14} />Show a repeat request</button>
            {confirmReset
              ? <span className="flex items-center gap-1"><button className="h-8 rounded-md border border-red-300 px-2 text-[12.5px] font-medium text-red-700" onClick={() => { reset(); setConfirmReset(false); router.push("/"); }}>Clear all work</button><button className="h-8 px-2 text-[12.5px] text-slate-600" onClick={() => setConfirmReset(false)}>Keep</button></span>
              : <button onClick={() => setConfirmReset(true)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100" aria-label="Reset to the start" title="Reset to the start"><Icon name="reset" size={15} /></button>}
            <button onClick={() => setCollapsed(true)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100" aria-label="Minimise the guided demo" title="Minimise"><Icon name="chevronDown" size={15} /></button>
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug text-slate-900 sm:text-[15px]" aria-live="polite">
              {caption ?? (scenario === "A" ? "Watch one supplier email become a routed contract request." : "A software renewal where the email and the order form disagree.")}
            </p>
            {cur && <button onClick={() => go(cur.focus)} className="text-left text-[12.5px] font-medium text-accent hover:underline">Show me where this happened →</button>}
          </div>
          <button onClick={prev} disabled={i === 0} aria-label="Previous step" className="flex h-10 shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] font-medium disabled:opacity-40 sm:px-3"><Icon name="chevronLeft" /><span className="hidden sm:inline">Back</span></button>
          <button onClick={() => go(next())} disabled={done} className="flex h-10 shrink-0 items-center gap-1 rounded-md bg-accent px-4 text-[13.5px] font-semibold text-white hover:bg-accent-700 disabled:opacity-50">
            {i === 0 ? "Start" : done ? "Finished" : "Next step"}{!done && <Icon name="chevronRight" />}
          </button>
        </div>
      </div>
    </section>
  );
}
