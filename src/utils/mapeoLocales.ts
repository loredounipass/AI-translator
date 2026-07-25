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
  ],
};

export const normalizarLocale = (locale: string): string => {
  // Algunos navegadores no soportan subtags numéricos como es-419
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1045179
  if (locale === 'es-419') return 'es-MX';
  return locale;
};

export const REGION_A_IDIOMA_BASE: Record<string, string> = {
  es: 'es', mex: 'es', col: 'es', chl: 'es', ven: 'es', gtm: 'es',
  dom: 'es', pri: 'es', slv: 'es', nic: 'es',
  en: 'en', usa: 'en', uk: 'en', india: 'en', philippines: 'en',
};
