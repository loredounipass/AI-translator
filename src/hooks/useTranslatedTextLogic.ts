import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { translate } from "api/ai-translation";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_MODEL, AI_MODELS } from "utils/constants";
import { debounce } from "lodash";
import { useAuth } from "contexts/AuthContext";
import { useApiKey } from "../contexts/ApiKeyContext";
import { historyService } from "utils/historyService";
import { showAuthRequiredNotification, showApiKeyRequiredNotification, showErrorToast } from "components/AppNotifications";
import { invalidateCacheForLanguagePair, invalidateCacheForModel } from "api/translation/cache";
import { translationMemory } from "api/translation/translationMemory";
import React from "react";



// CLEAN TRANSLATED TEXT FROM INCOMPLETE XML TAGS
const cleanText = (rawText: string) => {
  if (!rawText) return "";
  
  return rawText.replace(/<\/?[a-z]*\s*$/i, "").trimStart();
};



// MAIN HOOK FOR TRANSLATED TEXT COMPONENT
export const useTranslatedTextLogic = () => {
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
  const historyLoadedRef = React.useRef(false);
  const prevModelKeyRef = React.useRef(modelId);
  const prevProviderRef = React.useRef(apiProvider);
  const prevSlRef = React.useRef(sl);
  const prevTlRef = React.useRef(tl);



  // POPULATE CACHE AND TRANSLATION MEMORY FROM HISTORY ON FIRST MOUNT
  React.useEffect(() => {
    if (!user || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    const loadHistoryIntoMemory = async () => {
      try {
        const items = await historyService.getAll(user.id);
        // Load the last 50 items (already sorted desc by created_at)
        const recent = items.slice(0, 50);

        // Iterate in reverse so oldest are added first (memory is chronological)
        for (let i = recent.length - 1; i >= 0; i--) {
          const item = recent[i];
          if (!item.source_text?.trim() || !item.translated_text?.trim()) continue;

          // Populate translation memory for model context
          translationMemory.add(
            item.source_text.trim(),
            item.translated_text.trim(),
            item.source_lang,
            item.target_lang
          );
        }
      } catch (err) {
        console.warn("Failed to load history into translation memory");
      }
    };

    loadHistoryIntoMemory();
  }, [user, modelId]);



  // HANDLE TRANSLATION REQUEST AND MANAGE STREAMING RESPONSE
  const translateHandler = React.useCallback(async (value: string, targetLang: string, sourceLang: string, mId: string, bypassCache: boolean = false) => {
    if (!value) {
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
        bypassCache,
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

  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<number | null>(null);
  const deleteTimeoutRef = React.useRef<number | null>(null);



  // COPY TRANSLATED TEXT TO CLIPBOARD
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
        showErrorToast(
          "No se pudo copiar",
          "La API de portapapeles no está disponible o requiere conexión segura (HTTPS)."
        );
      }
    } catch (error) {
      console.error("Copy error:", error);
    }
  };



  // DEBOUNCE TRANSLATE HANDLER FOR PERFORMANCE
  const debouncedTranslateHandler = React.useMemo(
    () =>
      debounce((text: string, targetLang: string, sourceLang: string, mId: string, bypassCache: boolean = false) => {
        translateHandler(text, targetLang, sourceLang, mId, bypassCache);
      }, 400),
    [translateHandler]
  );



  // TRIGGER TRANSLATION WHEN URL PARAMS OR AUTH STATE CHANGES
  React.useEffect(() => {
    currentTextRef.current = text;

    // CLEAR PREVIOUS TRANSLATION WHEN THE MODEL OR PROVIDER CHANGES
    const modelChanged = prevModelKeyRef.current !== modelId || prevProviderRef.current !== apiProvider;
    if (modelChanged) {
      invalidateCacheForModel(prevModelKeyRef.current);
    }
    prevModelKeyRef.current = modelId;
    prevProviderRef.current = apiProvider;

    const langChanged = prevSlRef.current !== sl || prevTlRef.current !== tl;
    if (langChanged) {
      invalidateCacheForLanguagePair(prevSlRef.current, prevTlRef.current);
      invalidateCacheForLanguagePair(sl, tl);
    }
    prevSlRef.current = sl;
    prevTlRef.current = tl;

    if (modelChanged || langChanged) {
      requestIdRef.current += 1;
      debouncedTranslateHandler.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setTranslatedText([]);
      setIsTranslating(false);
    }

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
        showAuthRequiredNotification();
      }
      setTranslatedText([]);
      return;
    }

    authNotifiedRef.current = false;

    if (keysLoading || !keysLoaded) return;

    if (user && keysForUserId !== user.id) return;

    if (!apiKey) {
      if (!apiKeyNotifiedRef.current) {
        apiKeyNotifiedRef.current = true;
        showApiKeyRequiredNotification();
      }
      setTranslatedText([]);
      return;
    }

    apiKeyNotifiedRef.current = false;

    debouncedTranslateHandler(text, tl, sl, modelId, langChanged);

    return () => {
      debouncedTranslateHandler.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [text, tl, sl, modelId, debouncedTranslateHandler, user, apiKey, apiProvider, authLoading, keysLoaded, keysLoading, keysForUserId]);



  // DISPATCH CUSTOM EVENT WHEN TRANSLATED TEXT CHANGES
  React.useEffect(() => {
    const event = new CustomEvent("translatedTextChanged", {
      detail: translatedText.join("\n"),
    });
    window.dispatchEvent(event);
  }, [translatedText]);

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



  // ANIMATE TYPEWRITER EFFECT FOR PLACEHOLDER MESSAGES
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



  // CLEANUP DEBOUNCER AND TIMEOUTS ON UNMOUNT
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

  return {
    isRTL,
    translatedText,
    isTranslating,
    copyHandler,
    copied,
    displayedText
  };
};
