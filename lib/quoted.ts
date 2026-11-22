// Replies carry the whole earlier thread underneath ("On Mon, Arjun wrote:", "> price is 20L", Outlook's From/Sent block).
// Ava reads only what the sender wrote this time, so an old price in the quote never becomes a fact.
// Client-safe: the basic extractor, the AI extractor and the mail view all use it.

const ATTRIBUTION = /^On\s.{3,200}\bwrote:\s*$/i;
const ORIGINAL = /^-{2,}\s*Original Message\s*-{2,}\s*$/i;
const RULE = /^_{5,}\s*$/;
const HEADER = /^From:\s*\S/i;
const SENT = /^(Sent|Date):\s*\S/i;

export interface SplitBody { fresh: string; quoted: string; hasQuote: boolean }

/** Where the quoted history starts, or -1. Quote-prefixed lines (">") are handled separately, wherever they sit. */
function quoteStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    // Gmail and Apple Mail wrap the attribution line, so check it alone and joined with the next line.
    if (ATTRIBUTION.test(l) || (i + 1 < lines.length && /^On\s/i.test(l) && ATTRIBUTION.test(`${l} ${lines[i + 1].trim()}`))) return i;
    if (ORIGINAL.test(l)) return i;
    if (RULE.test(l) && lines.slice(i + 1, i + 3).some((x) => HEADER.test(x.trim()))) return i;
    if (HEADER.test(l) && lines.slice(i + 1, i + 4).some((x) => SENT.test(x.trim()))) return i;
  }
  return -1;
}

export function splitQuoted(body: string): SplitBody {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const at = quoteStart(lines);
  const top = at < 0 ? lines : lines.slice(0, at);
  const kept = top.filter((l) => !/^\s*>/.test(l));
  const quoted = [...(at < 0 ? [] : lines.slice(at)), ...top.filter((l) => /^\s*>/.test(l))].join("\n").trim();
  const fresh = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // A message that is only quoted text (a bare forward) keeps everything: dropping it would drop the whole message.
  if (!fresh) return { fresh: body.trim(), quoted: "", hasQuote: false };
  return { fresh, quoted, hasQuote: quoted.length > 0 };
}

export const stripQuoted = (body: string) => splitQuoted(body).fresh;
