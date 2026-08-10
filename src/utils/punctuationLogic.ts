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

  const lowerTrimmed = trimmed.toLowerCase();

  // 1. If it contains inverted marks anywhere, enforce matching ending punctuation
  if (trimmed.includes('¿')) return trimmed + '?';
  if (trimmed.includes('¡')) return trimmed + '!';

  // 2. Safely extract the very first actual word (ignoring leading punctuation like ¡¿,.)
  const firstWordMatch = trimmed.match(/^[\W_]*([\p{L}\p{N}]+)/u);
  const firstWord = firstWordMatch ? firstWordMatch[1].toLowerCase() : '';

  if (questionWords.has(firstWord)) return trimmed + '?';
  
  // 3. Special multi-word question phrases (like por qué, est-ce que)
  const cleanStart = lowerTrimmed.replace(/^[\W_]+/, '');
  if (cleanStart.startsWith('por qué')) return trimmed + '?';
  if (cleanStart.startsWith('est-ce que') || cleanStart.startsWith('est-ce qu\'')) return trimmed + '?';

  // 4. Exclamations
  if (exclamationPatterns.test(firstWord)) return trimmed + '!';

  return trimmed + '.';
};
