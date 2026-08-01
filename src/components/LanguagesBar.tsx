import React from "react";
import { Select } from "antd";
import { useSearchParams } from "react-router-dom";
import { 
  AVAILABLE_LANGUAGES, 
  DEFAULT_SOURCE_LANGUAGE, 
  DEFAULT_TARGET_LANGUAGE 
} from "utils/constants";
import { REGIONES_POR_IDIOMA, getSavedRegion, saveRegion, syncRegionsFromSupabase } from "../utils/mapeoLocales";
import { SwitchIcon } from "../assets/SwitchIcon";
import { useAuth } from "contexts/AuthContext";
import { languagePrefsService } from "../utils/languagePrefsService";

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
  const sourceLang = validateLang(searchParams.get("sl"), DEFAULT_SOURCE_LANGUAGE);
  const targetLang = validateLang(searchParams.get("tl"), DEFAULT_TARGET_LANGUAGE);

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

    if (user) {
      languagePrefsService.savePrefs(user.id, newSource, newTarget);
    }
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

      setURLSearchParams(params => {
        params.set("sl", value);
        if (nuevoSr) params.set("sr", nuevoSr);
        else params.delete("sr");
        return params;
      });
      if (nuevoSr && user) await saveRegion(value, nuevoSr, user.id);
      
      if (user) {
        languagePrefsService.savePrefs(user.id, value, targetLang);
      }
    }
  };

  const handleChangeTargetLang = (value: string) => {
    if(value === sourceLang) switchLangsHandler();
    else {
      updateLang(value, "tl");
      if (user) {
        languagePrefsService.savePrefs(user.id, sourceLang, value);
      }
    }
  };

  const updateLang = React.useCallback(
    (
      value: string,
      paramKey: "sl" | "tl"
    ) => {
      if (AVAILABLE_LANGUAGES.some((lang) => lang.code === value)) {
        setLangParam(paramKey, value);
      }
    },
    [setLangParam]
  );

  const hasLoadedPrefsForUser = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (user && hasLoadedPrefsForUser.current !== user.id) {
      hasLoadedPrefsForUser.current = user.id;
      Promise.all([
        syncRegionsFromSupabase(user.id),
        languagePrefsService.getPrefs(user.id)
      ]).then(([_, prefs]) => {
        if (prefs) {
          const validSl = validateLang(prefs.source_lang, DEFAULT_SOURCE_LANGUAGE);
          const validTl = validateLang(prefs.target_lang, DEFAULT_TARGET_LANGUAGE);
          
          setURLSearchParams(params => {
            params.set("sl", validSl);
            params.set("tl", validTl);
            
            // Set the correct dialect (region) for the newly loaded source language
            const regiones = REGIONES_POR_IDIOMA[validSl];
            if (regiones) {
              const savedSr = getSavedRegion(validSl);
              params.set("sr", savedSr || regiones[0].code);
            } else {
              params.delete("sr");
            }
            
            return params;
          });
        }
      });
    }
  }, [user]); // Quitamos setURLSearchParams para evitar loops infinitos si cambia su referencia

  React.useEffect(() => {
    const urlSl = searchParams.get("sl");
    const urlTl = searchParams.get("tl");

    // 1. Si faltan parámetros en la URL, los rellenamos (en una sola navegación)
    if (!urlSl || !urlTl) {
      setURLSearchParams(params => {
        if (!params.get("sl")) {
          const sl = DEFAULT_SOURCE_LANGUAGE;
          const regiones = REGIONES_POR_IDIOMA[sl];
          params.set("sl", sl);
          if (regiones) params.set("sr", getSavedRegion(sl) || regiones[0].code);
        }
        if (!params.get("tl")) {
          params.set("tl", DEFAULT_TARGET_LANGUAGE);
        }
        return params;
      });
    }
  }, [searchParams, setURLSearchParams]);

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
