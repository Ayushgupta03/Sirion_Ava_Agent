// Money, date and text helpers. Indian number format.

export function inr(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  const neg = n < 0; n = Math.round(Math.abs(n));
  const s = String(n);
  let out = s;
  if (s.length > 3) {
    const last3 = s.slice(-3); let rest = s.slice(0, -3);
    const parts: string[] = [];
    while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
    if (rest) parts.unshift(rest);
    out = parts.join(",") + "," + last3;
  }
  return (neg ? "-₹" : "₹") + out;
}

/** Short form: ₹20L, ₹21.5L, ₹2 crore */
export function lakh(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e7) return `₹${trim(n / 1e7)} crore`;
  if (Math.abs(n) >= 1e5) return `₹${trim(n / 1e5)}L`;
  return inr(n);
}
function trim(x: number) { return (Math.round(x * 100) / 100).toString(); }

/** Parse "₹20L", "₹21,50,000", "about ₹20 lakh", "₹2 crore", "Rs 6,00,000", "2400000" */
export function parseAmount(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const t = s.replace(/ /g, " ");
  const m = t.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(l\b|lakh|lac|cr\b|crore|k\b)?/i) || t.match(/\b([\d,]{4,}(?:\.\d+)?)\s*(l\b|lakh|lac|cr\b|crore)?/i) || t.match(/\b(\d+(?:\.\d+)?)\s*(l\b|lakh|lac|cr\b|crore)/i);
  if (!m) return undefined;
  let n = parseFloat(m[1].replace(/,/g, ""));
  const u = (m[2] || "").toLowerCase();
  if (u.startsWith("l")) n *= 1e5; else if (u.startsWith("cr")) n *= 1e7; else if (u === "k") n *= 1e3;
  return isNaN(n) ? undefined : Math.round(n);
}

export function parseMonths(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(week|wk|month|mo|year|yr)/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]); const u = m[2].toLowerCase();
  if (u.startsWith("w")) return Math.round((n / 4) * 10) / 10;
  if (u.startsWith("y")) return n * 12;
  return n;
}

export function parseBoolAccess(s: string | undefined): number | undefined {
  if (!s) return undefined;
  if (/\b(no|none|not)\b/i.test(s) && !/admin access/i.test(s)) return 0;
  if (/\byes\b|access|customer data|personal data|customer records/i.test(s)) return 1;
  return undefined;
}

export function parseAutoRenew(s: string | undefined): number | undefined {
  if (!s) return undefined;
  if (/does not renew|no automatic renewal|not renew automatically|no auto-?renew|removed/i.test(s)) return 0;
  if (/renews? automatically|auto-?renew/i.test(s)) return 1;
  return undefined;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Parse "8 Dec 2029", "31 Mar 2027", "2026-12-08", "Monday 16 Nov" (year from ref) to YYYY-MM-DD */
export function parseDate(s: string | undefined, refYear = 2026): string | undefined {
  if (!s) return undefined;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s*(\d{4})?/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return `${m[3] || refYear}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return undefined;
}

export function ymd(iso: string): string { return iso.slice(0, 10); }

const IST = "+05:30";
/** Build ISO with IST offset. */
export function ist(date: string, time: string) { return `${date}T${time}:00${IST}`; }

export function toDate(iso: string) { return new Date(iso); }
export function addMinutes(iso: string, mins: number): string { return isoIST(new Date(new Date(iso).getTime() + mins * 60000)); }
export function addMonths(dateYmd: string, months: number): string {
  const d = new Date(dateYmd + "T00:00:00Z");
  const whole = Math.floor(months); const days = Math.round((months - whole) * 30);
  d.setUTCMonth(d.getUTCMonth() + whole); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function isoIST(d: Date): string {
  const t = new Date(d.getTime() + 330 * 60000);
  return t.toISOString().slice(0, 19) + IST;
}
export function daysBetween(aYmd: string, bYmd: string) {
  return Math.round((new Date(bYmd + "T00:00:00Z").getTime() - new Date(aYmd + "T00:00:00Z").getTime()) / 86400000);
}
export function hoursBetween(a: string, b: string) { return (new Date(b).getTime() - new Date(a).getTime()) / 3600000; }

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parts(iso: string) {
  const t = new Date(new Date(iso).getTime() + 330 * 60000);
  return { dow: DOW[t.getUTCDay()], d: t.getUTCDate(), mon: MON[t.getUTCMonth()], y: t.getUTCFullYear(), hh: String(t.getUTCHours()).padStart(2, "0"), mm: String(t.getUTCMinutes()).padStart(2, "0"), day: t.getUTCDay() };
}
export function fmtDT(iso: string) { const p = parts(iso); return `${p.dow} ${p.d} ${p.mon}, ${p.hh}:${p.mm}`; }
/** One date format everywhere: "Thu 12 Nov, 10:12". */
export function fmtShort(iso: string) { return fmtDT(iso); }
export function fmtTime(iso: string) { const p = parts(iso); return `${p.hh}:${p.mm}`; }
export function fmtDate(ymdOrIso: string) {
  const iso = ymdOrIso.length === 10 ? ymdOrIso + "T12:00:00+05:30" : ymdOrIso;
  const p = parts(iso); return `${p.d} ${p.mon} ${p.y}`;
}
export function fmtDay(ymdOrIso: string) {
  const iso = ymdOrIso.length === 10 ? ymdOrIso + "T12:00:00+05:30" : ymdOrIso;
  const p = parts(iso); return `${p.dow} ${p.d} ${p.mon}`;
}
export function istYmd(iso: string) { const t = new Date(new Date(iso).getTime() + 330 * 60000); return t.toISOString().slice(0, 10); }

/** Business days elapsed: weekdays after the start date up to and including the end date. */
export function businessDays(startIso: string, endIso: string): number {
  let d = istYmd(startIso); const end = istYmd(endIso); let n = 0;
  while (d < end) {
    const nd = new Date(d + "T00:00:00Z"); nd.setUTCDate(nd.getUTCDate() + 1); d = nd.toISOString().slice(0, 10);
    const dow = new Date(d + "T00:00:00Z").getUTCDay(); if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export function nextWeekday(fromIso: string, dow: number): string {
  const d = new Date(istYmd(fromIso) + "T00:00:00Z");
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== dow);
  return d.toISOString().slice(0, 10);
}

export function domainOf(addr: string) { const m = addr.toLowerCase().match(/@([^>\s]+)/); return m ? m[1] : ""; }
export function norm(s: string) { return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim(); }
export function uid(prefix = "id") { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }

/** Human time spans: "just now", "3 h", "2 days". */
export function span(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)} h`;
  const d = Math.round(hours / 24); return `${d} day${d === 1 ? "" : "s"}`;
}
export function ago(fromIso: string, toIso: string) { const h = hoursBetween(fromIso, toIso); return h < 1 ? "just now" : `${span(h)} ago`; }
export function closedAfter(fromIso: string, toIso: string) { const h = hoursBetween(fromIso, toIso); return h < 1 ? "closed within the hour" : `closed after ${span(h)}`; }
