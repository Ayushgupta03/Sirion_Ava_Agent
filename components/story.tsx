"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAva } from "@/lib/store";
import { resolveFocus } from "@/lib/story";
import { cx } from "./ui";
import { Icon } from "./icons";

export const CHAPTERS = [
  { slug: "why", label: "Why intake", q: "Why fix intake first?" },
  { slug: "problem", label: "The problem", q: "Is the problem real, and who does it hurt?" },
  { slug: "stakeholders", label: "Stakeholders", q: "Who has a stake, and where do they clash?" },
  { slug: "metrics", label: "Metrics", q: "How will we know it works?" },
  { slug: "assumptions", label: "Assumptions", q: "What are we taking as given?" },
  { slug: "sirion", label: "Ava and Sirion", q: "Where does Ava fit next to Sirion?" },
];

/** Page frame: chapter rail, the question this page answers, the answer in one line, then the evidence. */
export function StoryFrame({ slug, answer, children }: { slug: string; answer: ReactNode; children: ReactNode }) {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  const ch = CHAPTERS[i]; const prev = CHAPTERS[i - 1]; const next = CHAPTERS[i + 1];
  return (
    <article className="enter mx-auto max-w-[1120px]">
      <nav aria-label="Case chapters" className="mb-6 overflow-x-auto">
        <ol className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {CHAPTERS.map((c, k) => (
            <li key={c.slug}><Link href={`/story/${c.slug}`} aria-current={k === i ? "page" : undefined} className={cx("flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]", k === i ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-100")}>
              <span className={cx("font-mono text-[11.5px]", k === i ? "text-white/70" : "text-slate-400")}>{String(k + 1).padStart(2, "0")}</span>{c.label}
            </Link></li>
          ))}
        </ol>
      </nav>
      <header className="mb-8 max-w-3xl">
        <p className="text-[13px] font-semibold text-accent">{ch.q}</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-[1.2] tracking-[-0.015em] text-slate-900 sm:text-[32px]">{answer}</h1>
      </header>
      <div className="space-y-10">{children}</div>
      <footer className="mt-12 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
        {prev ? <Link href={`/story/${prev.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-accent"><span className="text-[12px] text-slate-500">← Previous</span><span className="block font-semibold">{prev.label}</span></Link> : <Link href="/" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-accent"><span className="text-[12px] text-slate-500">← Back to</span><span className="block font-semibold">Overview</span></Link>}
        {next ? <Link href={`/story/${next.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 text-right hover:border-accent"><span className="text-[12px] text-slate-500">Next →</span><span className="block font-semibold">{next.label}</span></Link> : <Link href="/inbox?compose=1" className="rounded-xl border border-accent bg-accent-50 p-4 text-right"><span className="text-[12px] text-accent-700">Now try it →</span><span className="block font-semibold text-accent-700">Send your own email to Ava</span></Link>}
      </footer>
    </article>
  );
}

export function Section({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
      {sub && <p className="mt-1 max-w-3xl text-[14px] text-slate-600">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Jumps the live demo to a step (replayed through the engine) and opens the screen where it happens. */
export function DemoLink({ sc, step, children }: { sc: "A" | "B"; step: number; children?: ReactNode }) {
  const jumpTo = useAva((s) => s.jumpTo); const router = useRouter();
  return (
    <button onClick={() => { const f = jumpTo(sc, step); if (f) router.push(resolveFocus(f, useAva.getState().state)); }} className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-[12.5px] font-medium text-accent-700 ring-1 ring-inset ring-accent-100 hover:bg-accent-100">
      <Icon name="play" size={11} />{children ?? `See it: Scenario ${sc}, step ${step}`}
    </button>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">{children}</a>;
}
