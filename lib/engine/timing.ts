// Cycle time against the 1-business-day target, and the longest department wait.
import type { State } from "../types";
import { businessDays, fmtShort, hoursBetween } from "../format";
import { personName, POLICY } from "./world";

const DOC_WAIT: Record<string, string> = { security_cert: "the supplier's renewed security certificate", insurance: "the supplier's insurance certificate" };

export function timingFor(state: State, reqId: string) {
  const req = state.requests[reqId];
  const firstAt = state.emails.find((e) => e.id === req.emailIds[0])?.sentAt ?? req.createdAt;
  const end = req.readyAt ?? state.now;
  const days = businessDays(firstAt, end);
  // Longest single wait on an approver or owner for this request.
  let best: { label: string; from: string; to: string; hours: number; why?: string } | undefined;
  for (const rec of Object.values(state.items)) {
    if (!rec.key.includes(`${reqId}:approval:`) && !rec.key.includes(`conflict:cf:${reqId}:`)) continue;
    for (const h of rec.history) {
      const to = h.closedAt ?? state.now; const hours = hoursBetween(h.openedAt, to);
      if (!best || hours > best.hours) {
        const key = rec.key.split(":approval:")[1];
        const label = key === "infosec" ? "InfoSec" : key === "vp" ? `VP (${personName(POLICY.vpApprover)})` : key === "budget_owner" ? "Budget owner" : "Procurement (conflict)";
        let why: string | undefined;
        for (const [ck, done] of Object.entries(req.checklistDone)) if (DOC_WAIT[ck] && done.at > h.openedAt && Math.abs(hoursBetween(done.at, to)) < 0.5) why = DOC_WAIT[ck];
        best = { label, from: h.openedAt, to, hours, why };
      }
    }
  }
  const longest = best ? `${best.label}${best.why ? `, waiting on ${best.why}` : ""} (${fmtShort(best.from)} to ${fmtShort(best.to)})` : undefined;
  return { firstAt, readyAt: req.readyAt, days, target: 1, met: !!req.readyAt && days <= 1, longest };
}
