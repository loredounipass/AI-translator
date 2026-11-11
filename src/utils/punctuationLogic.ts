// Multi-language question word detection
// NOTE: single-word auxiliaries that are equally common as non-question starters
// ('yo', french 'a', portuguese 'a') are intentionally excluded: they produced
// false '?' on plain declarative dictation
export const questionWords = new Set([
  'what', 'who', 'where', 'when', 'why', 'how', 'which', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'am', 'has', 'have', 'had',
  'que', 'qué', 'quien', 'quién', 'quienes', 'quiénes', 'donde', 'dónde', 'cuando', 'cuándo', 'como', 'cómo', 'por', 'cuál', 'cual', 'cuáles', 'cuales', 'cuánto', 'cuánta', 'cuántos', 'cuántas', 'puede', 'puedes', 'podría', 'podrías', 'es', 'son', 'era', 'eran', 'tiene', 'tienes', 'hace', 'hacen',
  'qui', 'quoi', 'où', 'quand', 'comment', 'pourquoi', 'combien', 'quel', 'quelle', 'est-ce', 'lequel', 'laquelle', 'lesquels', 'lesquelles', 'peux', 'peut', 'pourrait', 'est', 'sont', 'avez',
  'quem', 'onde', 'quando', 'quanto', 'quanta', 'quantos', 'quantas', 'qual', 'quais', 'pode', 'poderia', 'é', 'são', 'tem',
  'wer', 'was', 'wo', 'wann', 'warum', 'wie', 'welcher', 'welche', 'welches', 'welchem', 'kann', 'kannst', 'könnte', 'könnten', 'ist', 'sind', 'war', 'waren', 'haben', 'hast',
  'chi', 'cosa', 'dove', 'perché', 'quale', 'quali', 'quanto', 'quanta', 'può', 'puoi', 'potrebbe', 'è', 'sono', 'ha', 'hai',
  'kim', 'ne', 'nerede', 'neden', 'niçin', 'nasıl', 'hangi', 'kaç',
  'هل', 'ما', 'من', 'أين', 'متى', 'لماذا', 'كيف', 'كم',
  'क्या', 'कौन', 'कहाँ', 'कब', 'क्यों', 'कैसे', 'कितना',
  '누구', '무엇', '어디', '언제', '왜', '어떻게',
  'なに', 'だれ', 'どこ', 'いつ', 'なぜ', 'どう', 'どの',
]);

// Exclamation patterns: interjections, imperatives, emotional markers
export const exclamationPatterns = /^(oh|wow|hey|stop|help|run|go|no|yes|sí|oye|alto|corre|ayuda|mira|cuidado|bravo|vamos|arrête|allez|achtung|hilfe|fermati|aiuto|pare|socorro|dur|imdat)$/i;

// Frases introductorias comunes que suelen llevar coma despues al inicio de oracion
export const INTRO_PHRASES = [
  'bueno', 'mira', 'o sea', 'entonces', 'escucha', 'oye',
  'ademas', 'sin embargo', 'por lo tanto', 'en fin', 'es decir',
  'claro', 'pues', 'a ver', 'dejame', 'mire', 'verdad', 'digamos'
];

const capitalizeFirst = (s: string): string => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const addPunctuation = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed || /[.!?…¿¡。？！]$/.test(trimmed)) return trimmed;

  const lowerTrimmed = trimmed.toLowerCase();

  // 1. If it contains inverted marks anywhere, enforce matching ending punctuation
  if (trimmed.includes('¿')) return capitalizeFirst(trimmed + '?');
  if (trimmed.includes('¡')) return capitalizeFirst(trimmed + '!');

  // 2. Remove common interpreter vocatives to find the TRUE first word of the sentence
  const withoutVocative = lowerTrimmed.replace(/^(interpreter|translator|intérprete|traductor|señor|señora|miss|mister|mr|ms|mrs)[\s,]+/i, '');
  // Extract the first word safely (ES5 compatible, avoiding the 'u' flag and \p{L})
  // Matches the first sequence of letters/numbers including ES/FR/DE accents
  const firstWordMatch = withoutVocative.match(/[a-z0-9áéíóúñüçàâäéèêëîïôœùûüÿß]+/i);
  const firstWord = firstWordMatch ? firstWordMatch[0].toLowerCase() : '';

  if (questionWords.has(firstWord)) return capitalizeFirst(trimmed + '?');
  
  // 3. Special multi-word question phrases (like por qué, est-ce que)
  const cleanStart = lowerTrimmed.replace(/^[\W_]+/, '');
  if (cleanStart.startsWith('por qué')) return capitalizeFirst(trimmed + '?');
  if (cleanStart.startsWith('est-ce que') || cleanStart.startsWith("est-ce qu'")) return capitalizeFirst(trimmed + '?');

  // 4. Introductory phrases: comma after the first word (before exclamation check)
  //    so words like 'mira' / 'bueno' get a comma instead of an exclamation mark.
  const introSpace = trimmed.indexOf(' ');
  if (introSpace > 0) {
    const introFirstWord = trimmed.slice(0, introSpace);
    if (INTRO_PHRASES.includes(introFirstWord.toLowerCase())) {
      return capitalizeFirst(introFirstWord + ',' + trimmed.slice(introSpace)) + '.';
    }
  }

  // 5. Exclamations
  if (exclamationPatterns.test(firstWord)) return capitalizeFirst(trimmed + '!');

  // 6. Default: period, capitalized first letter
  return capitalizeFirst(trimmed + '.');
};
