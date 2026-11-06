// PURE, SIDE-EFFECT-FREE HELPERS FOR STABLE DICTATION TEXT WRITES.
// SHARED BY BOTH TRANSCRIPTION MODES:
//  - AI STT  -> mergeSharedOverlap + ceiling handling in the caller
//  - NATIVE  -> computeInterimNext (interim) and applyClosingPunctuation (close)

import { addPunctuation } from "./punctuationLogic";

// LONGEST OVERLAP BETWEEN TAIL OF `a` AND HEAD OF `b`, SO DELTA APPENDS
// DON'T DUPLICATE WORDS REPEATED ACROSS ASR CHUNKS
export const mergeSharedOverlap = (a: string, b: string): string => {
  if (!a) return b;
  if (!b) return a;
  const maxK = Math.min(a.length, b.length);
  for (let k = maxK; k > 0; k--) {
    if (a.endsWith(b.slice(0, k))) {
      return k === b.length ? a : a + b.slice(k);
    }
  }
  return a + " " + b;
};

// SPLIT AT FIRST DIFFERENCE: HEAD IS THE STABLE PART BOTH VERSIONS SHARE
export const splitAtFirstDiff = (current: string, next: string): { head: string; tail: string } => {
  const n = Math.min(current.length, next.length);
  let i = 0;
  while (i < n && current[i] === next[i]) i++;
  return { head: current.slice(0, i), tail: current.slice(i) };
};

// TRUE WHEN THE NEW TEXT ONLY EXTENDS WHAT'S ALREADY ON SCREEN:
// IN THAT CASE PREVIOUS STABLE CHARACTERS MUST NOT BE REWRITTEN
export const isPureExtension = (current: string, next: string): boolean =>
  next.length > current.length && next.startsWith(current);

// NATIVE INTERIM UPDATE DECISION: RETURNS THE NEW TEXT TO WRITE, OR NULL WHEN
// NOTHING REALLY CHANGED (WRITING AN IDENTICAL VALUE WOULD JUST RE-RENDER).
// REVISIONS NEVER TOUCH THE STABLE HEAD: ONLY THE TAIL FROM THE FIRST
// DIFFERENT CHARACTER IS REPLACED
export const computeInterimNext = (current: string, next: string): string | null => {
  if (current === next) return null;
  if (isPureExtension(current, next)) return next;
  const { head } = splitAtFirstDiff(current, next);
  return head + next.slice(head.length);
};

// SEGMENT CLOSURE (NATIVE MODE): PUNCTUATE ONLY THE TAIL DICTED IN THIS
// SESSION; THE HEAD TYPED OR DICTED BEFORE MUST SURVIVE BYTE-IDENTICAL,
// INCLUDING THE SEPARATING WHITESPACE
export const applyClosingPunctuation = (text: string, prefixLen: number, fallbackTail: string): string => {
  const p = Math.min(prefixLen, text.length);
  const head = text.slice(0, p);
  const rest = text.slice(p);
  const body = rest.trim() || fallbackTail;
  if (!body) return text;
  const leadingSpace = rest.match(/^\s+/)?.[0] ?? "";
  return head + leadingSpace + addPunctuation(body);
};
