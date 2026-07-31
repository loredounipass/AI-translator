import React from "react";
import { Select } from "antd";
import { useSearchParams } from "react-router-dom";
import { 
  AVAILABLE_LANGUAGES, 
  DEFAULT_SOURCE_LANGUAGE, 
  DEFAULT_TARGET_LANGUAGE 
} from "utils/constants";
import { REGIONES_POR_IDIOMA, getSavedRegion, saveRegion } from "../utils/mapeoLocales";
import { SwitchIcon } from "../assets/SwitchIcon";
import { useAuth } from "contexts/AuthContext";

const LanguagesBar = () => {
  const { user } = useAuth();
  const translatedTextRef = React.useRef("");
  const MAX_URL_TEXT_LENGTH = 8000;

  React.useEffect(() => {
    const handleTranslationChange = (e: any) => {
      translatedTextRef.current = e.detail;
    };
    window.addEventListener("translatedTextChanged", handleTranslationChange);
    return () => window.removeEventListener("translatedTextChanged", handleTranslationChange);
  }, []);

  const [searchParams, setURLSearchParams] = useSearchParams();
  const [sourceLang, setSourceLang] = React.useState(
    validateLang(searchParams.get("sl"), DEFAULT_SOURCE_LANGUAGE)
  );
  const [targetLang, setTargetLang] = React.useState(
    validateLang(searchParams.get("tl"), DEFAULT_TARGET_LANGUAGE)
  );

  const languageOptions = React.useMemo(() => 
    AVAILABLE_LANGUAGES.map(lang => ({
      value: lang.code,
      label: lang.name,
      disabled: false
    })), []);

  const setLangParam = React.useCallback((key: string, value: string) => {
    setURLSearchParams(params => {
      params.set(key, value);
      return params;
    });
  }, [setURLSearchParams]);

  const switchLangsHandler = () => {
    const newSource = targetLang;
    const newTarget = sourceLang;
    const newText = translatedTextRef.current;
    const regiones = REGIONES_POR_IDIOMA[newSource];
    const nuevoSr = regiones
      ? (getSavedRegion(newSource) || regiones[0].code)
      : null;

    setSourceLang(newSource);
    setTargetLang(newTarget);
    setURLSearchParams(params => {
      params.set("sl", newSource);
      params.set("tl", newTarget);
      if (nuevoSr) params.set("sr", nuevoSr);
      else params.delete("sr");
      if (newText) {
        params.set("text", newText.length > MAX_URL_TEXT_LENGTH ? newText.slice(0, MAX_URL_TEXT_LENGTH) : newText);
      }
      return params;
    });
  };

  const handleChangeSourceLang = async (value: string) => {
    if (value === targetLang) {
      switchLangsHandler();
      return;
    }
    if (AVAILABLE_LANGUAGES.some((lang) => lang.code === value)) {
      const regiones = REGIONES_POR_IDIOMA[value];
      const nuevoSr = regiones
        ? (getSavedRegion(value) || regiones[0].code)
        : null;

      setSourceLang(value);
      setURLSearchParams(params => {
        params.set("sl", value);
        if (nuevoSr) params.set("sr", nuevoSr);
        else params.delete("sr");
        return params;
      });
      if (nuevoSr && user) await saveRegion(value, nuevoSr, user.id);
    }
  };

  const handleChangeTargetLang = (value: string) => {
    if(value === sourceLang) switchLangsHandler();
    else updateLang(value, setTargetLang, "tl");
  };

  const updateLang = React.useCallback(
    (
      value: string,
      setter: React.Dispatch<React.SetStateAction<string>>,
      paramKey: "sl" | "tl"
    ) => {
      if (AVAILABLE_LANGUAGES.some((lang) => lang.code === value)) {
        setter(value);
        setLangParam(paramKey, value);
      }
    },
    [setLangParam]
  );

  React.useEffect(() => {
    if (user) {
      import("../utils/mapeoLocales").then(m => m.syncRegionsFromSupabase(user.id));
    }
  }, [user]);

  React.useEffect(() => {
    if (!searchParams.get("sl")) {
      const sl = DEFAULT_SOURCE_LANGUAGE;
      const regiones = REGIONES_POR_IDIOMA[sl];
      const savedSr = getSavedRegion(sl);
      setURLSearchParams(params => {
        params.set("sl", sl);
        if (regiones) params.set("sr", savedSr || regiones[0].code);
        return params;
      });
    }
    if (!searchParams.get("tl")) setLangParam("tl", DEFAULT_TARGET_LANGUAGE);
  }, [searchParams, setLangParam, setURLSearchParams]);

  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-between p-2 md:p-3 px-5 md:px-6 gap-2 md:gap-4 border-b border-slate-200 dark:border-slate-700 w-full overflow-hidden transition-colors">
      <Select<string>
        value={sourceLang}
        onChange={handleChangeSourceLang}
        options={languageOptions as unknown as { value: string; label: string }[]}
        aria-label="Seleccionar idioma origen"
        popupMatchSelectWidth={false}
        className="lang-select w-0 flex-1 min-w-0"
      />
      
      <button
        onClick={switchLangsHandler}
        aria-label="Intercambiar idiomas"
        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer p-1.5 md:p-2 rounded-full transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-600 hover:rotate-180 hover:scale-110 active:rotate-180 active:scale-95 text-slate-500 dark:text-slate-300 shadow-sm flex-shrink-0"
      >
        <SwitchIcon />
      </button>
      
      <Select<string>
        value={targetLang}
        onChange={handleChangeTargetLang}
        options={languageOptions as unknown as { value: string; label: string }[]}
        aria-label="Seleccionar idioma destino"
        popupMatchSelectWidth={false}
        className="lang-select w-0 flex-1 min-w-0"
      />
    </div>
  );
};

const validateLang = (lang: string | null, fallback: string): string => {
  return lang && AVAILABLE_LANGUAGES.some(l => l.code === lang) 
    ? lang 
    : fallback;
};

export default React.memo(LanguagesBar);
