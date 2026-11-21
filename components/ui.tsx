"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Source } from "@/lib/types";
import { useAva } from "@/lib/store";

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

const TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-accent-50 text-accent-700 ring-accent-100",
  grey: "bg-slate-100 text-slate-700 ring-slate-200",
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = "grey", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone])}>{children}</span>;
}

export function StateChip({ state }: { state: string }) {
  const map: Record<string, [Tone, string]> = {
    confirmed: ["green", "Confirmed"], unconfirmed: ["amber", "Unconfirmed"], contradicted: ["red", "Contradicted"], missing: ["red", "Missing"],
    done: ["green", "Done"], pending: ["amber", "Pending"], waiting_supplier: ["amber", "Waiting on supplier"], excepted: ["blue", "Excepted"], legal_review: ["blue", "Assigned to Legal review"],
    approved: ["green", "Approved"], reconfirmed: ["green", "Reconfirmed"], needs_reconfirmation: ["red", "Needs reconfirmation"],
    open: ["red", "Open"], resolved: ["green", "Resolved"], blocking: ["red", "Blocking"], warning: ["amber", "Warning"],
    ready_legal: ["green", "Ready for Legal Review"], ready_po: ["green", "Ready to issue PO"], blocked: ["red", "Blocked"], in_progress: ["amber", "In intake"],
  };
  const [tone, label] = map[state] ?? ["grey", state];
  return <Chip tone={tone}>{label}</Chip>;
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cx("rounded-xl border border-slate-200 bg-white", className)}>{children}</section>;
}
export function CardHead({ title, right, sub }: { title: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div><h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>{sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}</div>
      {right}
    </div>
  );
}

export function Button({ children, onClick, variant = "secondary", small, disabled, title, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost"; small?: boolean; disabled?: boolean; title?: string; type?: "button" | "submit" }) {
  const v = { primary: "bg-accent text-white hover:bg-accent-700 border-accent", secondary: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300", danger: "bg-white text-red-700 hover:bg-red-50 border-red-300", ghost: "bg-transparent border-transparent text-slate-700 hover:bg-slate-100" }[variant];
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={cx("inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50", small ? "px-2 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]", v)}>{children}</button>;
}

export function SourceLink({ src, label }: { src?: Source; label?: string }) {
  const open = useAva((s) => s.openSource);
  if (!src) return <span className="text-slate-400">—</span>;
  if (!src.emailId) return <span className="text-[12px] text-slate-500" title={src.quote}>{label ?? (src.file === "directory" ? "Directory" : src.file === "person" ? "Person" : src.file)}</span>;
  const text = label ?? (src.file === "email" ? "Email" : `${src.file}${src.page ? `, p.${src.page}` : ""}`);
  return (
    <button onClick={() => open(src)} className="text-left text-[12px] font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent" title={`Show source: "${src.quote}"`}>
      {text}
    </button>
  );
}

export function Quote({ src, note }: { src: Source & { note?: string }; note?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[13px] text-slate-800">“{src.quote}”</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500"><SourceLink src={src} />{(note ?? src.note) && <span>· {note ?? src.note}</span>}</div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[12px] font-medium text-slate-500">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular", tone === "red" ? "text-red-700" : tone === "green" ? "text-emerald-700" : "text-slate-900")}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h1>{sub && <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-slate-600">{sub}</p>}</div>
      {right}
    </div>
  );
}

export function ReqLink({ id, children }: { id: string; children?: ReactNode }) {
  return <Link href={`/requests/${id}`} className="font-medium text-accent hover:underline">{children ?? id}</Link>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500">{children}</div>;
}

/** Supplier display name: "Trivenika Systems", "Kosha Analytics" (never the lowercase id). */
export function supplierShort(name?: string) { return (name ?? "").replace(/\s+(Pvt\.? Ltd\.?|Private Limited|LLP|Ltd\.?)$/i, ""); }
