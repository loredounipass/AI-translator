import React from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { notification } from "antd";
import type { NotificationArgsProps } from "antd";
import { translate } from "api/ai-translation";
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, DEFAULT_MODEL, AI_MODELS } from "utils/constants";
import { debounce } from "lodash";
import { useAuth } from "contexts/AuthContext";
import { useApiKey } from "../contexts/ApiKeyContext";
import { historyService } from "utils/historyService";



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



  // HANDLE TRANSLATION REQUEST AND MANAGE STREAMING RESPONSE
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



  // DEBOUNCE TRANSLATE HANDLER FOR PERFORMANCE
  const debouncedTranslateHandler = React.useMemo(
    () =>
      debounce((text: string, targetLang: string, sourceLang: string, mId: string) => {
        translateHandler(text, targetLang, sourceLang, mId);
      }, 400),
    [translateHandler]
  );



  // TRIGGER TRANSLATION WHEN URL PARAMS OR AUTH STATE CHANGES
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
        notification.open({
          message: (
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
              Inicia sesión para continuar
            </span>
          ) as NotificationArgsProps["message"],
          description: (
            <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Necesitas una cuenta para usar el agente de traducción. Es gratis y rápido.
            </span>
          ) as NotificationArgsProps["description"],
          icon: (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
          ),
          placement: "topRight",
          duration: 5,
          style: {
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(99,102,241,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e7ff",
            padding: "14px 18px",
          },
        });
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
        notification.open({
          message: (
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
              API Key requerida
            </span>
          ) as NotificationArgsProps["message"],
          description: (
            <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Agrega una API key de tu proveedor preferido para activar las traducciones.
            </span>
          ) as NotificationArgsProps["description"],
          icon: (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
            </div>
          ),
          placement: "topRight",
          duration: 6,
          style: {
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(245,158,11,0.15), 0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #fef3c7",
            padding: "14px 18px",
          },
        });
      }
      setTranslatedText([]);
      return;
    }

    apiKeyNotifiedRef.current = false;

    debouncedTranslateHandler(text, tl, sl, modelId);

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
