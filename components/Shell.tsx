"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAva, type Ripple } from "@/lib/store";
import { deriveItems } from "@/lib/engine/items";
import { fmtDT } from "@/lib/format";
import { person } from "@/lib/engine/world";
import { cx } from "./ui";
import { Icon, type IconName } from "./icons";
import SourceViewer from "./SourceViewer";
import DemoBar from "./guide/DemoBar";
import GuideLayer from "./guide/GuideLayer";
import HelpMenu from "./guide/HelpMenu";
import { useCoachVisible } from "./guide/state";

export const VIEW_AS: { id: string; role: string }[] = [
  { id: "rahul", role: "Requester, Sales Ops" }, { id: "neha", role: "Requester, Marketing Ops" }, { id: "suresh", role: "Requester, Finance" },
  { id: "karan", role: "Procurement, owns every request" }, { id: "meera", role: "InfoSec reviewer" }, { id: "farah", role: "Legal" },
  { id: "ananya", role: "Budget owner, Sales Ops" }, { id: "deepa", role: "Budget owner, Finance" }, { id: "ritu", role: "Budget owner, Marketing" }, { id: "vikram", role: "VP Sales, approves over ₹25L" },
];
export const roleOf = (id: string) => VIEW_AS.find((v) => v.id === id)?.role ?? "";
export const initials = (id: string) => (person(id)?.name ?? id).split(" ").map((w) => w[0]).join("").slice(0, 2);

const WORK: { href: string; label: string; icon: IconName; key?: "mine" | "requests" }[] = [
  { href: "/new", label: "Ask Ava", icon: "spark" },
  { href: "/mail", label: "Captured mail", icon: "inbox" },
  { href: "/today", label: "Today", icon: "checkCircle", key: "mine" },
  { href: "/requests", label: "Requests", icon: "list", key: "requests" },
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
];
const CASE = [["why", "Why intake"], ["problem", "The problem"], ["stakeholders", "Stakeholders"], ["metrics", "Metrics"], ["assumptions", "Assumptions"], ["sirion", "Ava and Sirion"]];

function useCounts() {
  const state = useAva((s) => s.state); const viewAs = useAva((s) => s.viewAs);
  return useMemo(() => {
    const items = deriveItems(state); const byPerson: Record<string, number> = {};
    items.forEach((i) => { byPerson[i.personId] = (byPerson[i.personId] ?? 0) + 1; });
    return { mine: byPerson[viewAs] ?? 0, byPerson, requests: state.requestOrder.length, conflicts: Object.values(state.conflicts).filter((c) => c.status === "open").length };
  }, [state, viewAs]);
}

export default function Shell({ children }: { children: ReactNode }) {
  const hydrate = useAva((s) => s.hydrate); const hydrated = useAva((s) => s.hydrated); const setAi = useAva((s) => s.setAi);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();
  useEffect(() => { hydrate(); fetch("/api/ava").then((r) => r.json()).then((d) => setAi(!!d.ai)).catch(() => setAi(false)); }, [hydrate, setAi]);
  useEffect(() => { setDrawer(false); }, [path]);
  usePulse();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      <div className={cx("fixed inset-0 z-40 bg-slate-900/30 md:hidden", drawer ? "block" : "hidden")} onClick={() => setDrawer(false)} />
      <aside aria-label="Main navigation" className={cx("fixed inset-y-0 left-0 z-50 w-[232px] border-r border-slate-200 bg-white transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-dvh md:w-auto md:translate-x-0", drawer ? "translate-x-0" : "-translate-x-full")}>
        <Sidebar drawer={drawer} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 md:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <span className="hidden truncate text-[13px] text-slate-500 xl:inline">Prayaan Software (fictional) · supplier email is simulated</span>
          {hydrated && <TopRight />}
        </header>
        <main id="main" className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-6 sm:px-6" style={{ paddingBottom: "calc(var(--dock-h, 120px) + 32px)" }}>
          {hydrated ? children : <div className="space-y-3"><div className="h-8 w-64 animate-pulse rounded bg-slate-200" /><div className="h-40 animate-pulse rounded-lg bg-slate-100" /></div>}
        </main>
        {hydrated && <DemoBar />}
      </div>
      {hydrated && <ToastStack />}
      {hydrated && <GuideLayer />}
      <SourceViewer />
    </div>
  );
}

/** Scrolls to the element a guided step changed and pulses it for 2 seconds. */
function usePulse() {
  const pulse = useAva((s) => s.pulse);
  useEffect(() => {
    if (!pulse.target) return;
    let tries = 0; let done = false;
    const t = setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-pulse="${pulse.target}"]`);
      if (el && !done) {
        done = true; clearInterval(t);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
        el.classList.remove("pulse-ring"); void el.offsetWidth; el.classList.add("pulse-ring");
        setTimeout(() => el.classList.remove("pulse-ring"), 2100);
      }
      if (++tries > 30) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [pulse.n, pulse.target]);
}

function Sidebar({ drawer }: { drawer: boolean }) {
  const path = usePathname(); const c = useCounts();
  const full = drawer;
  const lbl = full ? "" : "md:hidden lg:inline";
  const linkCls = (active: boolean) => cx("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px]", full ? "" : "md:justify-center lg:justify-start", active ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900");
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className={cx("flex items-center gap-2.5 px-4 pb-3 pt-4", full ? "" : "md:justify-center md:px-2 lg:justify-start lg:px-4")} aria-label="Ava, home">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-[14px] font-bold text-white">A</span>
        <span className={cx("leading-tight", lbl)}><span className="block text-[15px] font-semibold">Ava</span><span className="block text-[11.5px] text-slate-500">Contract intake agent</span></span>
      </Link>
      <nav className={cx("flex-1 overflow-y-auto px-3 pb-3", full ? "" : "md:px-2 lg:px-3")}>
        <div className={cx("px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400", lbl)}>Workspace</div>
        <ul className="space-y-0.5">
          {WORK.map((n) => { const active = path.startsWith(n.href) || (n.href === "/requests" && (path.startsWith("/conflicts") || path.startsWith("/suppliers"))); const count = n.key ? c[n.key] : 0; return (
            <li key={n.href}><Link href={n.href} title={n.label} aria-label={`${n.label}${count ? `, ${count}` : ""}`} aria-current={active ? "page" : undefined} className={linkCls(active)}>
              <span className="relative"><Icon name={n.icon} size={18} className={active ? "text-accent" : "text-slate-400"} />{n.key === "mine" && !!count && !full && <span className="absolute -right-1.5 -top-1 hidden h-2 w-2 rounded-full bg-red-600 md:block lg:hidden" />}</span>
              <span className={cx("flex-1", lbl)}>{n.label}</span>
              {!!count && <span className={cx("min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular", n.key === "mine" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600", lbl)}>{count}</span>}
            </Link></li>); })}
        </ul>
        <div className={cx("px-2.5 pb-1 pt-6", lbl)}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">About the case</div>
          <div className="text-[11.5px] text-slate-500">6 short pages, about 5 min</div>
        </div>
        {!full && <div className="mx-auto my-4 hidden h-px w-8 bg-slate-200 md:block lg:hidden" />}
        <ol className="space-y-0.5">
          {CASE.map(([slug, label], i) => { const active = path === `/story/${slug}`; return (
            <li key={slug}><Link href={`/story/${slug}`} title={label} aria-label={`${i + 1}. ${label}`} aria-current={active ? "page" : undefined} className={linkCls(active)}>
              <span className={cx("grid h-[18px] w-[18px] shrink-0 place-items-center rounded font-mono text-[11px]", active ? "bg-accent text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
              <span className={cx("flex-1", lbl)}>{label}</span>
            </Link></li>); })}
        </ol>
      </nav>
      <div className={cx("border-t border-slate-200 p-3", full ? "" : "md:p-2 lg:p-3")}>
        <Link href="/settings" title="Settings" aria-label="Settings" className={linkCls(path.startsWith("/settings"))}><Icon name="settings" size={18} className="text-slate-400" /><span className={lbl}>Settings</span></Link>
      </div>
    </div>
  );
}

function TopRight() {
  const { state, tick } = useAva();
  const c = useCounts();
  const viewAs = useAva((s) => s.viewAs);
  const [clock, setClock] = useState(false);
  return (
    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
      <div className="relative" data-tour="clock">
        <button onClick={() => setClock(!clock)} aria-expanded={clock} aria-label={`Simulated clock: ${fmtDT(state.now)}`} className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[13px] sm:px-2.5">
          <Icon name="clock" className="shrink-0 text-slate-400" /><span className="hidden whitespace-nowrap font-mono text-[12.5px] sm:inline">{fmtDT(state.now)}</span>
        </button>
        {clock && <div className="absolute right-0 top-11 z-40 w-60 rounded-lg border border-slate-200 bg-white p-2 text-[13px] shadow-lg" onKeyDown={(e) => e.key === "Escape" && setClock(false)}>
          <p className="px-2 pb-1.5 text-slate-500">Simulated time: {fmtDT(state.now)}. It drives ages, deadlines and the 90-day window.</p>
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => { tick(60); setClock(false); }}>Move forward 1 hour</button>
          <button className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => { tick(60 * 24); setClock(false); }}>Move forward 1 day</button>
        </div>}
      </div>
      <HelpMenu />
      <Link href="/today" aria-label={`${c.mine} items waiting on ${person(viewAs)?.name}`} className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 bg-white">
        <Icon name="bell" />
        {c.mine > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10.5px] font-bold text-white">{c.mine}</span>}
      </Link>
      <ViewAsMenu counts={c.byPerson} />
    </div>
  );
}

function ViewAsMenu({ counts }: { counts: Record<string, number> }) {
  const viewAs = useAva((s) => s.viewAs); const setViewAs = useAva((s) => s.setViewAs);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} data-tour="view-as" className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Viewing as ${person(viewAs)?.name}, ${roleOf(viewAs)}. Switch person`} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white pl-1 pr-2 hover:bg-slate-50">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-100 text-[11.5px] font-semibold text-accent-700">{initials(viewAs)}</span>
        <span className="hidden text-left leading-tight sm:block"><span className="block text-[11px] text-slate-500">Viewing as</span><span className="block max-w-[150px] truncate text-[13px] font-semibold">{person(viewAs)?.name}</span></span>
        <Icon name="chevronDown" className="text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-24px))] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <p className="px-2.5 pb-1.5 pt-1 text-[12px] text-slate-500">See and act as any person. Each sees only what is waiting on them.</p>
          {VIEW_AS.map((v) => (
            <button key={v.id} role="menuitemradio" aria-checked={v.id === viewAs} onClick={() => { setViewAs(v.id); setOpen(false); }} className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", v.id === viewAs ? "bg-accent-50" : "hover:bg-slate-50")}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11.5px] font-semibold text-slate-700">{initials(v.id)}</span>
              <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-medium">{person(v.id)?.name}</span><span className="block truncate text-[11.5px] text-slate-500">{v.role}</span></span>
              {counts[v.id] ? <span className="whitespace-nowrap rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{counts[v.id]} waiting</span> : <span className="whitespace-nowrap text-[11.5px] text-slate-400">nothing waiting</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToastStack() {
  // While the coach card is up it already says who acted and who was reached, so the two toasts for the same step stay quiet.
  const coaching = useCoachVisible(); const stepLabel = useAva((s) => s.caption); const ripple = useAva((s) => s.ripple);
  const sameStep = coaching && !!ripple && ripple.label === stepLabel;
  return (
    <div className="pointer-events-none fixed right-4 top-[68px] z-40 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {!coaching && <ActorToast />}
      {!sameStep && <RippleToast />}
    </div>
  );
}

function ActorToast() {
  const toast = useAva((s) => s.toast); const dismiss = useAva((s) => s.dismissToast); const setViewAs = useAva((s) => s.setViewAs);
  const router = useRouter();
  useEffect(() => { if (!toast) return; const t = setTimeout(dismiss, 8000); return () => clearTimeout(t); }, [toast, dismiss]);
  if (!toast) return null;
  return (
    <div role="status" className="pointer-events-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <div className="flex items-start gap-2.5">
        <Icon name="users" className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-semibold">Now acting as {toast.actors.map((a) => `${person(a)?.name} (${roleOf(a).split(",")[0].replace(/^(Budget owner|Requester|Procurement|Legal)$/, (m) => m.toLowerCase())})`).join(" and ")}</p>
          <p className="text-slate-600">The demo did this as them. Your own view has not changed.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{toast.actors.map((a) => <button key={a} onClick={() => { setViewAs(a); dismiss(); router.push("/today"); }} className="rounded-md border border-slate-300 px-2 py-1 text-[12.5px] font-medium hover:bg-slate-50">Switch view to {person(a)?.name.split(" ")[0]}</button>)}</div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}

const NOUN: Record<string, string> = { question: "question", info: "note", draft: "draft to send", approval: "approval", reconfirm: "reconfirmation", conflict: "conflict", competing: "quote task", retro: "reason to record", legal: "legal item", packet: "handoff packet", supplier: "supplier check", orphan: "invoice to confirm", unsorted: "unsorted invoice", finance: "finance task", mention: "mention" };
const tally = (xs: { kind: string }[]) => { const m = new Map<string, number>(); xs.forEach((x) => m.set(x.kind, (m.get(x.kind) ?? 0) + 1)); return [...m].map(([k, n]) => `${n} ${NOUN[k] ?? k}${n > 1 ? "s" : ""}`).join(", "); };

/** Who the last change reached. Each row is a person whose queue changed, with a way to step into their view. */
function RippleToast() {
  const ripple = useAva((s) => s.ripple); const dismiss = useAva((s) => s.dismissRipple); const setViewAs = useAva((s) => s.setViewAs); const viewAs = useAva((s) => s.viewAs);
  const router = useRouter();
  useEffect(() => { if (!ripple) return; const t = setTimeout(dismiss, 14000); return () => clearTimeout(t); }, [ripple, dismiss]);
  if (!ripple) return null;
  const R: Ripple = ripple; const who = R.actor === "none" || R.actor === "system" ? "" : `${person(R.actor)?.name.split(" ")[0] ?? R.actor} `;
  return (
    <div role="status" aria-label="Who this change reached" className="pointer-events-auto rounded-xl border border-accent-100 bg-white p-3 shadow-lg">
      <div className="flex items-start gap-2">
        <Icon name="send" className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-semibold">What this reached</p>
          <p className="line-clamp-2 text-[12px] text-slate-500">{who}{R.label}</p>
          <ul className="mt-2 space-y-1.5">
            {R.rows.slice(0, 5).map((r) => (
              <li key={r.personId} className="flex items-start gap-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10.5px] font-semibold text-slate-700">{initials(r.personId)}</span>
                <span className="min-w-0 flex-1 leading-snug"><b>{person(r.personId)?.name.split(" ")[0]}</b>{r.opened.length > 0 && <span className="text-slate-700"> now has {tally(r.opened)}</span>}{r.closed.length > 0 && <span className="text-slate-500">{r.opened.length ? "; " : " "}{tally(r.closed)} cleared</span>}</span>
                {r.personId !== viewAs && <button onClick={() => { setViewAs(r.personId); dismiss(); router.push("/today"); }} className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[11.5px] font-medium hover:bg-slate-50">View as</button>}
              </li>))}
          </ul>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}
