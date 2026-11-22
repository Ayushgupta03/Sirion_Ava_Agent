"use client";
import { splitQuoted } from "@/lib/quoted";

/** An email body with the quoted earlier messages folded away. Ava ignores that part, and says so. */
export function QuotedBody({ body, className }: { body: string; className?: string }) {
  const { fresh, quoted, hasQuote } = splitQuoted(body);
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap">{fresh}</div>
      {hasQuote && (
        <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 text-[13px]">
          <summary className="cursor-pointer px-3 py-1.5 font-medium text-slate-600">Earlier messages in this thread · Ava ignores quoted text</summary>
          <div className="whitespace-pre-wrap border-t border-slate-200 px-3 py-2 text-slate-500">{quoted}</div>
        </details>)}
    </div>
  );
}
