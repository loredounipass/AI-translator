export const MAPEO_LOCALES: Record<string, string> = {
  // Variantes de Español
  es: 'es-419',
  espanol: 'es-419',
  spanish: 'es-419',
  slv: 'es-SV',
  salvador: 'es-SV',
  nic: 'es-NI',
  nicaragua: 'es-NI',
  mex: 'es-MX',
  mexico: 'es-MX',
  dom: 'es-DO',
  'republica dominicana': 'es-DO',
  pri: 'es-PR',
  'puerto rico': 'es-PR',
  chl: 'es-CL',
  chile: 'es-CL',
  col: 'es-CO',
  colombia: 'es-CO',
  ven: 'es-VE',
  venezuela: 'es-VE',
  gtm: 'es-GT',
  guatemala: 'es-GT',

  // Variantes e inflexiones de Inglés
  en: 'en-GB',
  english: 'en-GB',
  ingles: 'en-GB',
  usa: 'en-US',
  americano: 'en-US',
  uk: 'en-GB',
  ingleses: 'en-GB',
  india: 'en-IN',
  indus: 'en-IN',
  philippines: 'en-PH',
  filipinos: 'en-PH',
  asiaticos: 'en-SG',
  africanos: 'en-ZA',
  haitianos: 'en-JM',
   egypt: 'en-EG',
   china: 'en-CN',
   russia: 'en-RU',
   ru: 'ru-RU',
  russian: 'ru-RU',
  zh: 'zh-CN',
  chinese: 'zh-CN',
  taiwan: 'zh-TW',
};

export const REGIONES_POR_IDIOMA: Record<string, { code: string; nombre: string }[]> = {
  es: [
    { code: 'es', nombre: 'Neutral' },
    { code: 'mex', nombre: 'México' },
    { code: 'col', nombre: 'Colombia' },
    { code: 'chl', nombre: 'Chile' },
    { code: 'ven', nombre: 'Venezuela' },
    { code: 'gtm', nombre: 'Guatemala' },
    { code: 'dom', nombre: 'Rep. Dominicana' },
    { code: 'pri', nombre: 'Puerto Rico' },
    { code: 'slv', nombre: 'El Salvador' },
    { code: 'nic', nombre: 'Nicaragua' },
  ],
  en: [
    { code: 'en', nombre: 'Neutral' },
    { code: 'usa', nombre: 'Estados Unidos' },
    { code: 'uk', nombre: 'Reino Unido' },
    { code: 'india', nombre: 'India' },
    { code: 'philippines', nombre: 'Filipinas' },
    { code: 'egypt', nombre: 'Egypt' },
    { code: 'africanos', nombre: 'African' },
    { code: 'haitianos', nombre: 'Haitian' },
    { code: 'china', nombre: 'Chinese' },
    { code: 'russia', nombre: 'Russian' },
  ],
  ru: [
    { code: 'ru', nombre: 'Neutral' },
  ],
  zh: [
    { code: 'zh', nombre: 'Neutral' },
    { code: 'taiwan', nombre: 'Taiwan' },
  ],
};

export const normalizarLocale = (locale: string): string => {
  if (locale === 'es-419') return 'es-MX';
  return locale;
};

// Locales de soporte amplio (Chrome, Edge Chromium)
const LOCALES_EXTENDIDOS = new Set([
  'es-419', 'es-SV', 'es-NI', 'es-DO', 'es-PR', 'es-CL', 'es-CO', 'es-VE', 'es-GT',
  'en-IN', 'en-PH', 'en-SG', 'en-ZA', 'en-JM', 'en-EG', 'en-CN', 'en-RU',
]);

// Locales universales (soportados en todos los navegadores con Web Speech API)
const LOCALES_UNIVERSALES = new Set([
  'es-ES', 'es-MX', 'en-US', 'en-GB', 'ru-RU', 'zh-CN', 'zh-TW',
]);

const esChromium = (): boolean => {
  const ua = navigator.userAgent;
  return ua.includes('Chrome') || ua.includes('Edge') || ua.includes('Chromium');
};

export const localeSoportado = (locale: string): boolean => {
  const normalizado = normalizarLocale(locale);
  if (LOCALES_UNIVERSALES.has(normalizado)) return true;
  if (LOCALES_EXTENDIDOS.has(locale)) return esChromium();
  return true;
};

export const filtrarRegiones = (
  regiones: { code: string; nombre: string }[]
): { code: string; nombre: string }[] => {
  return regiones.filter(r => {
    const locale = MAPEO_LOCALES[r.code] || r.code;
    return localeSoportado(locale);
  });
};

export const REGION_A_IDIOMA_BASE: Record<string, string> = {
  es: 'es', mex: 'es', col: 'es', chl: 'es', ven: 'es', gtm: 'es',
  dom: 'es', pri: 'es', slv: 'es', nic: 'es',
  en: 'en', usa: 'en', uk: 'en', india: 'en', philippines: 'en', egypt: 'en', africanos: 'en', haitianos: 'en', china: 'en', russia: 'en',
  ru: 'ru',
  zh: 'zh', taiwan: 'zh',
};

const STORAGE_KEY = 'source_regions';

export const getSavedRegion = (base: string): string | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const regions: Record<string, string> = JSON.parse(saved);
    const code = regions[base];
    if (!code) return null;
    return REGION_A_IDIOMA_BASE[code] === base ? code : null;
  } catch { return null; }
};

export const saveRegion = (base: string, code: string): void => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const regions: Record<string, string> = saved ? JSON.parse(saved) : {};
    regions[base] = code;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(regions));
  } catch { /* localStorage not available */ }
};
