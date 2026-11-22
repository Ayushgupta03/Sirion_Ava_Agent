// Kept apart from extractText.ts so client code can use it without pulling in the server-only xlsx and pdf libraries.
/** PDF text comes back one visual line at a time, so a long "Scope: ..." line arrives cut in two.
 *  Rejoin a labelled line with the line that continues it: the label line has no closing punctuation,
 *  and the next line starts in lower case and is not a table row. Safe to run twice. */
export function joinWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const isLabelled = prev !== undefined && /^[A-Z][A-Za-z ()/&-]{0,30}:\s/.test(prev) && !/[.!?:;]$/.test(prev);
    if (isLabelled && /^[a-z]/.test(line) && !/\s{2,}/.test(line)) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}
