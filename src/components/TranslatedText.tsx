import React from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { notification } from "antd";
import { translate } from "api/ai-translation";
import CopyIcon from "assets/CopyIcon";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_MODEL, AI_MODELS } from "utils/constants";
import { debounce } from "lodash";
import { useAuth } from "contexts/AuthContext";
import { useApiKey } from "../contexts/ApiKeyContext";
import { historyService } from "utils/historyService";

const cleanText = (rawText: string) => {
  if (!rawText) return "";
  
  // La API (ai-translation.ts) ahora garantiza que solo se emita el texto traducido.
  // Solo aplicamos un filtro final cosmético para ocultar etiquetas XML incompletas 
  // que el modelo pueda estar tipeando al final del stream (ej. "</trans").
  
  return rawText.replace(/<\/?[a-z]*\s*$/i, "").trimStart();
};

const TranslatedText = () => {
  const [searchParams] = useSearchParams();
  const text = searchParams.get("text") || "";
  const tl = searchParams.get("tl") || DEFAULT_TARGET_LANGUAGE;
  const sl = searchParams.get("sl") || DEFAULT_SOURCE_LANGUAGE;
  const modelKey = searchParams.get("model") || DEFAULT_MODEL;
  const config = AI_MODELS[modelKey as keyof typeof AI_MODELS] || AI_MODELS[DEFAULT_MODEL as keyof typeof AI_MODELS];
  const modelId = config.id;
  const apiProvider = searchParams.get("provider") || config.apiProvider;
  const isRTL = ["ar", "fa", "ur"].includes(tl);
  const [translatedText, setTranslatedText] = React.useState<string[]>([]);
  const [isTranslating, setIsTranslating] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const currentTextRef = React.useRef(text);
  const requestIdRef = React.useRef(0);
  const lastSavedKeyRef = React.useRef("");
  const { user, loading: authLoading } = useAuth();
  const userRef = React.useRef(user);
  userRef.current = user;
  const { getKey, keysLoaded, keysLoading, keysForUserId } = useApiKey();
  const apiKey = getKey(apiProvider);
  const apiKeyRef = React.useRef(apiKey);
  apiKeyRef.current = apiKey;
  const authNotifiedRef = React.useRef(false);
  const apiKeyNotifiedRef = React.useRef(false);

  const translateHandler = React.useCallback(async (value: string, targetLang: string, sourceLang: string, mId: string) => {
    if (!value || value !== currentTextRef.current) {
      setTranslatedText([]);
      setIsTranslating(false);
      return;
    }

    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    try {
      setIsTranslating(true);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const translated = await translate(targetLang, sourceLang, value, mId, {
        signal: abortControllerRef.current.signal,
        apiKey: apiKeyRef.current || undefined,
        provider: apiProvider,
        onData: (text) => {
          const cleaned = cleanText(text);
          if (cleaned) {
            setTranslatedText([cleaned]);
          }
        },
      });

      if (translated) {
        const cleaned = cleanText(translated);
        setTranslatedText(cleaned ? [cleaned] : []);

        if (cleaned && value.trim() && userRef.current) {
          const key = `${value.trim()}|${sourceLang}|${targetLang}`;
          if (lastSavedKeyRef.current === key) return;
          lastSavedKeyRef.current = key;
          window.setTimeout(() => {
            historyService.add(userRef.current!.id, value.trim(), cleaned, sourceLang, targetLang);
            window.dispatchEvent(new Event("historyUpdated"));
          }, 0);
        }
      }
    } catch (error) {
      if (axios.isCancel(error)) return;
      if (!(error instanceof DOMException)) {
        if (currentRequestId === requestIdRef.current) {
          setTranslatedText([]);
        }
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsTranslating(false);
      }
    }
  }, [setTranslatedText, apiKey, apiProvider]);

  const copyHandler = async () => {
    try {
      const txt = translatedText.join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
        setCopied(true);
        if (copyTimeoutRef.current) {
          window.clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
      } else {
        notification.error({
          message: "No se pudo copiar",
          description: "La API de portapapeles no está disponible o requiere conexión segura (HTTPS).",
          placement: "topRight"
        });
      }
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  const debouncedTranslateHandler = React.useMemo(
    () =>
      debounce((text: string, targetLang: string, sourceLang: string, mId: string) => {
        translateHandler(text, targetLang, sourceLang, mId);
      }, 600),
    [translateHandler]
  );

  React.useEffect(() => {
    currentTextRef.current = text;

    if (!text) {
      debouncedTranslateHandler.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setTranslatedText([]);
      setIsTranslating(false);
      return;
    }

    if (authLoading) return;

    if (!userRef.current) {
      if (!authNotifiedRef.current) {
        authNotifiedRef.current = true;
        notification.warning({
          message: "Authentication required",
          description: "You must be authenticated to use the translation agent.",
          placement: "topRight",
          duration: 4,
        });
      }
      setTranslatedText([]);
      return;
    }

    authNotifiedRef.current = false;

    if (keysLoading || !keysLoaded) return;

    // Guard: don't check apiKey until keys have been fetched for the CURRENT user
    if (user && keysForUserId !== user.id) return;

    if (!apiKey) {
      if (!apiKeyNotifiedRef.current) {
        apiKeyNotifiedRef.current = true;
        notification.warning({
          message: "API key required",
          description: "You must add an API key from your preferred provider.",
          placement: "topRight",
          duration: 5,
        });
      }
      setTranslatedText([]);
      return;
    }

    apiKeyNotifiedRef.current = false;

    // Always re-translate when text, target lang, source lang, or model change
    debouncedTranslateHandler(text, tl, sl, modelId);

    return () => {
      debouncedTranslateHandler.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [text, tl, sl, modelId, debouncedTranslateHandler, user, apiKey, apiProvider, authLoading, keysLoaded, keysLoading, keysForUserId]);

  React.useEffect(() => {
    const event = new CustomEvent("translatedTextChanged", {
      detail: translatedText.join("\n"),
    });
    window.dispatchEvent(event);
  }, [translatedText]);




  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<number | null>(null);
  const deleteTimeoutRef = React.useRef<number | null>(null);

  const messages = React.useMemo(() => [
    "Translate any text instantly now",
    "Interpreter AI agent always ready",
    "Type and I'll translate instantly",
    "Fast AI translation",
    "Select your language and start",
  ], []);

  const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
  const [displayedText, setDisplayedText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const typingSpeed = isDeleting ? 30 : 60;
    const currentMessage = messages[placeholderIndex];

    const timer = setTimeout(() => {
      if (translatedText.length > 0 || isTranslating) return;

      if (!isDeleting && displayedText === currentMessage) {
        deleteTimeoutRef.current = window.setTimeout(() => setIsDeleting(true), 2500);
      } else if (isDeleting && displayedText === "") {
        setIsDeleting(false);
        setPlaceholderIndex((prev) => (prev + 1) % messages.length);
      } else {
        setDisplayedText(currentMessage.substring(0, displayedText.length + (isDeleting ? -1 : 1)));
      }
    }, typingSpeed);

    return () => {
      clearTimeout(timer);
      if (deleteTimeoutRef.current !== null) {
        window.clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
    };
  }, [displayedText, isDeleting, placeholderIndex, messages, translatedText.length, isTranslating]);

  React.useEffect(() => {
    return () => {
      debouncedTranslateHandler.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, [debouncedTranslateHandler]);

  return (
    <div className={`relative bg-[#f3f4f6] dark:bg-slate-800 text-[#0f1720] dark:text-slate-100 font-sans font-normal leading-normal ${isRTL ? 'text-right' : 'text-left'} text-lg break-words min-h-[100px] border-t md:border-t-0 md:border-l border-[#e6e9ee] dark:border-slate-700/50 flex-1 flex flex-col transition-colors`}>
      {translatedText.length === 0 && !isTranslating ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-[#9ca3af] dark:text-slate-400 text-base font-normal p-4 px-6 text-center leading-relaxed">
          <div className="flex items-center justify-center">
            {displayedText}
            <span className="relative flex h-2 w-2 ml-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9ca3af] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9ca3af]"></span>
            </span>
          </div>
        </div>
      ) : translatedText.length === 0 && isTranslating ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-[#9ca3af] dark:text-slate-400 text-sm font-normal p-4 px-6 text-center leading-relaxed gap-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span className="text-xs tracking-wide text-slate-400 dark:text-slate-500">Translating...</span>
        </div>
      ) : (
        <div className="p-4 pb-14 overflow-auto max-h-[75vh] blue-scrollbar h-full whitespace-pre-wrap">
          {translatedText.join("\n")}
        </div>
      )}
      {translatedText.length !== 0 && (
        <div className="absolute bottom-2.5 right-2.5">
          <button onClick={copyHandler} aria-label="Copiar texto" className="bg-none border-none cursor-pointer p-1 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-110">
            <div className="text-[#2196F3] dark:text-blue-400">
              <CopyIcon />
            </div>
          </button>
        </div>
      )}
      {copied && <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 bg-[#333] text-white px-4 py-2 rounded-lg text-[13px] font-sans shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-20 animate-fadeIn whitespace-nowrap">Text copied</div>}
    </div>
  );
};

export default TranslatedText;