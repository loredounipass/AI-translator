import {
  mergeSharedOverlap,
  isPureExtension,
  computeInterimNext,
  applyClosingPunctuation,
} from "../dictationMerge";
import { addPunctuation } from "../punctuationLogic";

const MAX_URL_TEXT_LENGTH = 8000;

// ---------------------------------------------------------------------------
// MODE AI STT: chunks arrive finalized, one per transcription request.
// The hook writes them through mergeSharedOverlap (onChunkRef).
// ---------------------------------------------------------------------------
describe("AI STT mode (chunk append)", () => {
  it("appends a fresh chunk separated by a space", () => {
    expect(mergeSharedOverlap("", "Hola buenas.")).toBe("Hola buenas.");
    expect(mergeSharedOverlap("Hola buenas.", "¿Cómo estás?")).toBe(
      "Hola buenas. ¿Cómo estás?"
    );
  });

  it("does not duplicate words repeated across chunk boundaries", () => {
    // ASR often repeats the last word between consecutive windows
    expect(mergeSharedOverlap("me gusta el", "el pescado frito")).toBe(
      "me gusta el pescado frito"
    );
  });

  it("drops a chunk fully already present at the end of the text", () => {
    expect(mergeSharedOverlap("hola mundo", "hola mundo")).toBe("hola mundo");
  });

  it("keeps spoken order when chunks are processed serially", () => {
    // Simulates the serialized queue: each chunk lands only after the previous settled
    const chunks = ["Primero esto.", "Luego esto.", "Y por último esto."];
    const text = chunks.reduce((acc, c) => mergeSharedOverlap(acc, c), "");
    expect(text).toBe("Primero esto. Luego esto. Y por último esto.");
  });

  it("never rewrites the stable head on append: previous text survives byte-identical", () => {
    const before = "primera oracion completa.";
    const after = mergeSharedOverlap(before, "segunda oracion tambien.");
    expect(after.startsWith(before)).toBe(true);
  });

  it("ceiling path stops instead of silently swallowing: merged length is detected", () => {
    const huge = "x".repeat(MAX_URL_TEXT_LENGTH);
    const merged = mergeSharedOverlap(huge, "una palabra mas");
    expect(merged.length).toBeGreaterThan(MAX_URL_TEXT_LENGTH);
    // The hook truncates and stops recording in that branch
    expect(merged.slice(0, MAX_URL_TEXT_LENGTH).length).toBe(MAX_URL_TEXT_LENGTH);
  });
});

// ---------------------------------------------------------------------------
// MODE NATIVE (browser SpeechRecognition): the transcript is rewritten
// retroactively on every interim. The hook writes through computeInterimNext.
// ---------------------------------------------------------------------------
describe("Native speech-to-text mode (interim updates)", () => {
  it("skips the write entirely when nothing changed (no flicker)", () => {
    expect(computeInterimNext("hola mundo", "hola mundo")).toBeNull();
  });

  it("pure extension keeps everything already on screen", () => {
    const current = "hola";
    const next = "hola mundo como estas";
    expect(isPureExtension(current, next)).toBe(true);
    const result = computeInterimNext(current, next);
    expect(result).toBe(next);
    expect(result!.startsWith(current)).toBe(true);
  });

  it("retroactive revision never touches the stable head", () => {
    // Browser first heard "casa", then corrects to "caza" mid-sentence
    const current = "yo quiero una casa grande";
    const revised = "yo quiero una caza grande"; // head up to index 15 unchanged
    const result = computeInterimNext(current, revised);
    expect(result).toBe(revised);
    // Everything before the first difference is preserved
    let i = 0;
    while (i < Math.min(current.length, revised.length) && current[i] === revised[i]) i++;
    expect(result!.slice(0, i)).toBe(current.slice(0, i));
  });

  it("interim updates add NO punctuation: the trailing edge stays clean", () => {
    // Regression: old code ran addPunctuation on every interim, making a '.'
    // appear and disappear at the right edge while the user kept talking
    const interim1 = "yo quiero ir al mercado";
    const interim2 = "yo quiero ir al mercado y comprar pan";
    expect(computeInterimNext("", interim1)).toBe(interim1);
    expect(computeInterimNext(interim1, interim2)).toBe(interim2);
    // Neither write ends with a mark
    expect(/[.!?]$/.test(computeInterimNext("", interim1)!)).toBe(false);
  });

  it("punctuation is applied once, at segment close, on the dictated tail only", () => {
    const prefix = "Texto previo del usuario. ";
    const text = prefix + "yo quiero ir al mercado";
    const closed = applyClosingPunctuation(text, prefix.length - 1, "yo quiero ir al mercado");
    // Head survives byte-identical, only the tail gains the mark
    expect(closed.startsWith(prefix)).toBe(true);
    expect(closed).toBe(prefix + "yo quiero ir al mercado.");
  });

  it("close keeps existing ending punctuation untouched (idempotent)", () => {
    const closed = applyClosingPunctuation("una frase ya cerrada.", 0, "");
    expect(closed).toBe("una frase ya cerrada.");
  });

  it("two consecutive sessions: closing punctuates only the new speech", () => {
    // Session 1 already closed with 'primera oracion.'; session 2 dictates the tail
    const head = "primera oracion. ";
    const text = head + "segunda oracion en dictado";
    const closed = applyClosingPunctuation(text, head.length - 1, "segunda oracion en dictado");
    expect(closed).toBe(head + "segunda oracion en dictado.");
    // The first session's final period was NOT doubled or moved
    expect(closed.split("").filter((ch) => ch === ".").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Punctuation correctness regressions (shared by both modes)
// ---------------------------------------------------------------------------
describe("addPunctuation regressions", () => {
  it("'yo quiero ...' is declarative, not a question", () => {
    expect(addPunctuation("yo quiero ir al mercado")).toBe("yo quiero ir al mercado.");
  });

  it("French 'a manger' no longer becomes a question", () => {
    expect(addPunctuation("a manger un pomme")).toBe("a manger un pomme.");
  });

  it("inverted marks still force the matching ending", () => {
    expect(addPunctuation("¿como estas")).toBe("¿como estas?");
    expect(addPunctuation("¡que alegria")).toBe("¡que alegria!");
  });

  it("real interrogatives still get '?'", () => {
    expect(addPunctuation("que hora es")).toBe("que hora es?");
    expect(addPunctuation("where is the station")).toBe("where is the station?");
  });

  it("already punctuated text is returned as-is (AI chunks safe)", () => {
    expect(addPunctuation("ya terminada.")).toBe("ya terminada.");
    expect(addPunctuation("¿ya terminada?")).toBe("¿ya terminada?");
  });
});
