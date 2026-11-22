// Which prompt produced an AI output. The version is a short hash of the prompt text, so it changes
// whenever a prompt changes and nobody has to remember to bump a number. Client-safe (no SDK import).
export function promptVersionOf(text: string): string {
  let h = 0x811c9dc5; // FNV-1a, 32 bit
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** What travels with an AI output so it can be traced and compared. */
export interface AiMeta { promptVersion?: string; model?: string }
