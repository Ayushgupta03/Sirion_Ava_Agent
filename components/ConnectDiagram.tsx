import { Icon, type IconName } from "./icons";

const STEPS: { icon: IconName; title: string; note: string; kind: "sim" | "ai" | "code" | "out" }[] = [
  { icon: "building", title: "Company mail server", note: "Microsoft 365 or Google Workspace", kind: "sim" },
  { icon: "repeat", title: "Mail rule copies supplier-domain email", note: "Set and owned by your IT team", kind: "sim" },
  { icon: "inbox", title: "Ava's mailbox", note: "Receives copies only", kind: "sim" },
  { icon: "file", title: "Read and extract", note: "AI, every fact with its quote", kind: "ai" },
  { icon: "list", title: "File, check, route", note: "Rules in plain code", kind: "code" },
  { icon: "bell", title: "Dashboard and Teams/Slack notices", note: "To internal people only", kind: "out" },
];
const TAG = { sim: "Simulated here", ai: "AI", code: "Code", out: "Internal only" };

/** How email reaches Ava, from the mail server to the people who act. */
export default function ConnectDiagram() {
  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-4">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-accent ring-1 ring-slate-200"><Icon name={s.icon} size={16} /></span>
              <span className={s.kind === "sim" ? "rounded bg-amber-100 px-1.5 text-[10.5px] font-semibold text-amber-800" : "rounded bg-accent-50 px-1.5 text-[10.5px] font-semibold text-accent-700"}>{TAG[s.kind]}</span>
            </div>
            <p className="mt-2 text-[13px] font-semibold leading-snug">{s.title}</p>
            <p className="text-[12px] text-slate-600">{s.note}</p>
            {i < STEPS.length - 1 && <Icon name="arrowRight" size={14} className="absolute -right-[11px] top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-slate-400 lg:block" />}
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 text-[13px] text-slate-700">Ava never has access to employee mailboxes. She only receives copies of supplier email. In this prototype the mailbox is simulated; everything after it is real.</figcaption>
    </figure>
  );
}
