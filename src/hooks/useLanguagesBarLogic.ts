import React from "react";
import { useSearchParams } from "react-router-dom";
import { 
  AVAILABLE_LANGUAGES, 
  DEFAULT_SOURCE_LANGUAGE, 
  DEFAULT_TARGET_LANGUAGE 
} from "utils/constants";
import { REGIONES_POR_IDIOMA, getSavedRegion, saveRegion, syncRegionsFromSupabase } from "../utils/mapeoLocales";
import { useAuth } from "contexts/AuthContext";
import { languagePrefsService } from "../utils/languagePrefsService";



// VALIDATE IF LANGUAGE EXISTS IN AVAILABLE LANGUAGES
const validateLang = (lang: string | null, fallback: string): string => {
  return lang && AVAILABLE_LANGUAGES.some(l => l.code === lang) 
    ? lang 
    : fallback;
};



// MAIN HOOK FOR LANGUAGES BAR COMPONENT
export const useLanguagesBarLogic = () => {
  const { user } = useAuth();
  const translatedTextRef = React.useRef("");
  const MAX_URL_TEXT_LENGTH = 8000;



  // LISTEN FOR TRANSLATED TEXT CHANGES
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



  // MEMOIZE LANGUAGE OPTIONS
  const languageOptions = React.useMemo(() => 
    AVAILABLE_LANGUAGES.map(lang => ({
      value: lang.code,
      label: lang.name,
      disabled: false
    })), []);



  // SET URL PARAMETER FOR LANGUAGE
  const setLangParam = React.useCallback((key: string, value: string) => {
    setURLSearchParams(params => {
      params.set(key, value);
      return params;
    }, { replace: true });
  }, [setURLSearchParams]);



  // SWITCH SOURCE AND TARGET LANGUAGES
  const switchLangsHandler = () => {
    const newSource = targetLang;
    const newTarget = sourceLang;
    const regiones = REGIONES_POR_IDIOMA[newSource];
    const nuevoSr = regiones
      ? (getSavedRegion(newSource) || regiones[0].code)
      : null;

    setURLSearchParams(params => {
      params.set("sl", newSource);
      params.set("tl", newTarget);
      if (nuevoSr) params.set("sr", nuevoSr);
      else params.delete("sr");
      params.delete("text");
      return params;
    }, { replace: true });

    if (user) {
      languagePrefsService.savePrefs(user.id, newSource, newTarget);
    }
  };



  // HANDLE SOURCE LANGUAGE CHANGE
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
      }, { replace: true });
      if (nuevoSr && user) await saveRegion(value, nuevoSr, user.id);
      
      if (user) {
        languagePrefsService.savePrefs(user.id, value, targetLang);
      }
    }
  };



  // UPDATE URL WITH NEW LANGUAGE
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



  // HANDLE TARGET LANGUAGE CHANGE
  const handleChangeTargetLang = (value: string) => {
    if(value === sourceLang) switchLangsHandler();
    else {
      updateLang(value, "tl");
      if (user) {
        languagePrefsService.savePrefs(user.id, sourceLang, value);
      }
    }
  };

  const hasLoadedPrefsForUser = React.useRef<string | null>(null);



  // SYNC LANGUAGE PREFERENCES FROM DATABASE
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
          }, { replace: true });
        }
      });
    }
  }, [user]);



  // ENSURE URL HAS REQUIRED LANGUAGE PARAMS
  React.useEffect(() => {
    const urlSl = searchParams.get("sl");
    const urlTl = searchParams.get("tl");

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
      }, { replace: true });
    }
  }, [searchParams, setURLSearchParams]);

  return {
    sourceLang,
    targetLang,
    languageOptions,
    switchLangsHandler,
    handleChangeSourceLang,
    handleChangeTargetLang
  };
};
