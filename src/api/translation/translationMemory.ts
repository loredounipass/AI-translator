import { isTrivialText } from "./filters";

export interface TranslationPair {
  source: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

const MAX_MEMORY_ITEMS = 50;
const MAX_PAIRS_PER_REQUEST = 10;

const memoryBuffer: TranslationPair[] = [];


// MEMORIA DE TRADUCCIÓN — BUFFER EN MEMORIA
export const translationMemory = {

  // AÑADIR UN NUEVO PAR DE TRADUCCIÓN AL BUFFER DE MEMORIA
  add(source: string, translated: string, sourceLang: string, targetLang: string): void {
    if (!source.trim() || !translated.trim()) return;
    if (isTrivialText(source, sourceLang, targetLang)) return;

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

    while (memoryBuffer.length > MAX_MEMORY_ITEMS) {
      memoryBuffer.shift();
    }
  },


  // OBTENER PARES DE TRADUCCIÓN RELEVANTES PARA UN PAR DE IDIOMAS
  getRelevant(
    sourceLang: string,
    targetLang: string,
    currentText?: string,
    limit: number = MAX_PAIRS_PER_REQUEST
  ): TranslationPair[] {
    const current = currentText?.trim();
    const currentWordCount = current ? current.split(/\s+/).length : 0;
    const isShortInput = currentWordCount > 0 && currentWordCount <= 4;

    const relevant: TranslationPair[] = [];

    for (const p of memoryBuffer) {
      let alignedSource: string;

      if (p.sourceLang === sourceLang && p.targetLang === targetLang) {
        alignedSource = p.source;
      } else if (p.sourceLang === targetLang && p.targetLang === sourceLang) {
        alignedSource = p.translated;
      } else {
        continue;
      }

      if (alignedSource === current) continue;

      if (isShortInput) {
        const pairWordCount = alignedSource.split(/\s+/).length;
        if (Math.abs(pairWordCount - currentWordCount) > 2) continue;
      }

      if (p.sourceLang === sourceLang && p.targetLang === targetLang) {
        relevant.push(p);
      } else {
        relevant.push({
          source: p.translated,
          translated: p.source,
          sourceLang,
          targetLang,
          timestamp: p.timestamp,
        });
      }
    }

    return relevant.slice(-limit);
  },


  // CONSTRUIR ARRAY DE MENSAJES PARA INYECTAR EN LA CONVERSACIÓN DEL MODELO
  buildMemoryMessages(
    sourceLang: string,
    targetLang: string,
    currentText?: string,
    limit: number = MAX_PAIRS_PER_REQUEST
  ): Array<{ role: string; content: string }> {
    const pairs = this.getRelevant(sourceLang, targetLang, currentText, limit);
    if (pairs.length === 0) return [];

    const messages: Array<{ role: string; content: string }> = [];
    for (const pair of pairs) {
      messages.push({ role: "user", content: pair.source });
      messages.push({ role: "assistant", content: pair.translated });
    }
    return messages;
  },


  // ELIMINAR UN TEXTO DE ORIGEN ESPECÍFICO DEL BUFFER DE MEMORIA
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


  // LIMPIAR TODO EL BUFFER DE MEMORIA (REINICIO)
  clear(): void {
    memoryBuffer.length = 0;
  },


  // OBTENER EL TAMAÑO ACTUAL DEL BUFFER DE MEMORIA
  get size(): number {
    return memoryBuffer.length;
  }
};
