// Multi-language question word detection
export const questionWords = new Set([
  'what', 'who', 'where', 'when', 'why', 'how', 'which', 'do', 'does', 'did', 'is', 'are', 'was', 'were', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'am', 'has', 'have', 'had',
  'que', 'qué', 'quien', 'quién', 'quienes', 'quiénes', 'donde', 'dónde', 'cuando', 'cuándo', 'como', 'cómo', 'por', 'cuál', 'cual', 'cuáles', 'cuales', 'cuánto', 'cuánta', 'cuántos', 'cuántas',
  'qui', 'quoi', 'où', 'quand', 'comment', 'pourquoi', 'combien', 'quel', 'quelle', 'est-ce', 'lequel', 'laquelle', 'lesquels', 'lesquelles',
  'quem', 'onde', 'quando', 'quanto', 'quanta', 'quantos', 'quantas', 'qual', 'quais',
  'wer', 'was', 'wo', 'wann', 'warum', 'wie', 'welcher', 'welche', 'welches', 'welchem',
  'chi', 'cosa', 'dove', 'perché', 'quale', 'quali', 'quanto', 'quanta',
  'kim', 'ne', 'nerede', 'neden', 'niçin', 'nasıl', 'hangi', 'kaç',
  'هل', 'ما', 'من', 'أين', 'متى', 'لماذا', 'كيف', 'كم',
  'क्या', 'कौन', 'कहाँ', 'कब', 'क्यों', 'कैसे', 'कितना',
  '누구', '무엇', '어디', '언제', '왜', '어떻게',
  'なに', 'だれ', 'どこ', 'いつ', 'なぜ', 'どう', 'どの',
]);

// Exclamation patterns: interjections, imperatives, emotional markers
export const exclamationPatterns = /^(oh|wow|hey|stop|help|run|go|no|yes|sí|oye|alto|corre|ayuda|mira|cuidado|bravo|vamos|arrête|allez|achtung|hilfe|fermati|aiuto|pare|socorro|dur|imdat)$/i;

export const addPunctuation = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed || /[.!?…¿¡。？！]$/.test(trimmed)) return trimmed;

  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  const lowerTrimmed = trimmed.toLowerCase();

  const startsWithInvertedQ = trimmed.startsWith('¿');
  const startsWithInvertedExcl = trimmed.startsWith('¡');

  if (startsWithInvertedQ) return trimmed + '?';
  if (startsWithInvertedExcl) return trimmed + '!';
  if (questionWords.has(firstWord)) return trimmed + '?';
  if (firstWord === 'por' && lowerTrimmed.startsWith('por qué')) return trimmed + '?';
  if (lowerTrimmed.startsWith('est-ce que') || lowerTrimmed.startsWith('est-ce qu\'')) return trimmed + '?';
  if (exclamationPatterns.test(firstWord)) return trimmed + '!';

  return trimmed + '.';
};
