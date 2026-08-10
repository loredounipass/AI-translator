import { isTrivialText } from "./filters";

// ==========================================
// TRANSLATION MEMORY — IN-MEMORY BUFFER
// ==========================================
// Mantiene un buffer circular de las últimas traducciones
// para inyectar como few-shot examples al modelo,
// dándole consistencia terminológica y memoria de sesión.

export interface TranslationPair {
  source: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

const MAX_MEMORY_ITEMS = 50;
const MAX_PAIRS_PER_REQUEST = 15;

const memoryBuffer: TranslationPair[] = [];


// ADD A NEW TRANSLATION PAIR TO THE MEMORY BUFFER
export const translationMemory = {

  add(source: string, translated: string, sourceLang: string, targetLang: string): void {
    if (!source.trim() || !translated.trim()) return;
    if (isTrivialText(source, sourceLang, targetLang)) return;

    // Avoid duplicates — remove existing entry for same source+langs
    const existingIndex = memoryBuffer.findIndex(
      (p) => p.source === source.trim() && p.sourceLang === sourceLang && p.targetLang === targetLang
    );
    if (existingIndex !== -1) {
      memoryBuffer.splice(existingIndex, 1);
    }

    memoryBuffer.push({
      source: source.trim(),
      translated: translated.trim(),
      sourceLang,
      targetLang,
      timestamp: Date.now(),
    });

    // Enforce max buffer size (circular)
    while (memoryBuffer.length > MAX_MEMORY_ITEMS) {
      memoryBuffer.shift();
    }
  },


  // GET RELEVANT TRANSLATION PAIRS FOR A LANGUAGE PAIR
  getRelevant(
    sourceLang: string,
    targetLang: string,
    currentText?: string,
    limit: number = MAX_PAIRS_PER_REQUEST
  ): TranslationPair[] {
    const relevant = memoryBuffer.filter(
      (p) => p.sourceLang === sourceLang && p.targetLang === targetLang &&
             p.source !== currentText?.trim()
    );

    // Return the most recent N pairs
    return relevant.slice(-limit);
  },


  // BUILD MESSAGES ARRAY FOR INJECTION INTO THE MODEL CONVERSATION
  buildMemoryMessages(
    sourceLang: string,
    targetLang: string,
    currentText?: string,
    useThinking: boolean = false
  ): Array<{ role: string; content: string }> {
    const pairs = this.getRelevant(sourceLang, targetLang, currentText);
    if (pairs.length === 0) return [];

    const messages: Array<{ role: string; content: string }> = [];
    for (const pair of pairs) {
      if (useThinking) {
        messages.push({ role: "user", content: `<source_text>\n${pair.source}\n</source_text>` });
        messages.push({ role: "assistant", content: `<thinking>\n(Memory Context)\n</thinking>\n<interpretation>\n${pair.translated}\n</interpretation>` });
      } else {
        messages.push({ role: "user", content: pair.source });
        messages.push({ role: "assistant", content: pair.translated });
      }
    }
    return messages;
  },


  // REMOVE A SPECIFIC SOURCE TEXT FROM THE MEMORY BUFFER.
  // Optionally restrict by language pair so only that entry is removed.
  remove(sourceText: string, sourceLang?: string, targetLang?: string): void {
    const trimmed = sourceText.trim();
    for (let i = memoryBuffer.length - 1; i >= 0; i--) {
      const pair = memoryBuffer[i];
      const langsMatch =
        sourceLang === undefined ||
        targetLang === undefined ||
        (pair.sourceLang === sourceLang && pair.targetLang === targetLang);
      if (pair.source === trimmed && langsMatch) {
        memoryBuffer.splice(i, 1);
      }
    }
  },


  // CLEAR THE ENTIRE MEMORY BUFFER (FRESH START)
  clear(): void {
    memoryBuffer.length = 0;
  },


  // GET THE CURRENT SIZE OF THE MEMORY BUFFER
  get size(): number {
    return memoryBuffer.length;
  },
};
