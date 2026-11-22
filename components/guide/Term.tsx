"use client";
// Helper text in context: a jargon word with a dotted underline that explains itself on hover, focus or click.
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { termById } from "@/lib/guide";

export function Term({ id, children }: { id: string; children: ReactNode }) {
  const t = termById(id); const [open, setOpen] = useState(false); const uid = useId(); const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!t) return <>{children}</>;
  return (
    <span ref={ref} className="relative inline" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-describedby={open ? uid : undefined} aria-expanded={open} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); e.stopPropagation(); } }}
        className="cursor-help rounded-sm border-0 bg-transparent p-0 font-[inherit] text-inherit underline decoration-slate-400 decoration-dotted underline-offset-[3px] hover:decoration-accent">
        {children}
      </button>
      {open && (
        <span id={uid} role="tooltip" className="absolute left-0 top-full z-[80] mt-1.5 block w-[min(300px,calc(100vw-32px))] rounded-lg border border-slate-200 bg-white p-3 text-left text-[12.5px] font-normal normal-case leading-snug tracking-normal text-slate-700 shadow-lg">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">{t.term}</span>
          <span className="mt-1 block">{t.def}</span>
        </span>
      )}
    </span>
  );
}

/** Renders copy that holds {{term-id|visible text}} markers, turning each marker into a Term. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\{\{[a-z-]+\|[^}]+\}\})/g);
  return <>{parts.map((p, i) => { const m = p.match(/^\{\{([a-z-]+)\|([^}]+)\}\}$/); return m ? <Term key={i} id={m[1]}>{m[2]}</Term> : <Fragment key={i}>{p}</Fragment>; })}</>;
}
