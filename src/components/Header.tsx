import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { AI_MODELS, DEFAULT_MODEL } from "utils/constants";
import { isReasoningModel } from "api/translation/constants";
import { useApiKey } from "contexts/ApiKeyContext";
import UserAvatar from "./UserAvatar";

import { SunIcon, MoonIcon, HistoryIcon, UserIcon, BrainIcon, ZapIcon, ChevronDownIcon, KeyIcon } from "./icons";

interface HeaderProps {
  isDark: boolean;
  toggleDark: () => void;
  openHistory: () => void;
  openAuth: () => void;
  user: User | null;
  onApiKeyNeeded: (provider: string) => void;
  onOpenApiSettings: () => void;
  onOpenFeedback?: () => void;
}

const Header = ({
  isDark,
  toggleDark,
  openHistory,
  openAuth,
  user,
  onApiKeyNeeded,
  onOpenApiSettings,
  onOpenFeedback,
}: HeaderProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentModel = searchParams.get("model") || DEFAULT_MODEL;
  const currentProvider = searchParams.get("provider") || AI_MODELS[currentModel]?.apiProvider || "nvidia";
  const { getKey } = useApiKey();

  // Badge thinker/instantanea del modelo actual (fuente: campo reasoning del registro).
  const currentModelInfo = AI_MODELS[currentModel];
  const isThinker = currentModelInfo
    ? currentModelInfo.reasoning ?? isReasoningModel(currentModelInfo.id)
    : false;

  // Dropdown custom de modelos: un <option> nativo no puede renderizar SVG, y los
  // emojis de marcador rompen la paleta. Panel liquid-glass con icono por clase.
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selectModel = (value: string) => {
    setModelMenuOpen(false);
    const modelConfig = AI_MODELS[value as keyof typeof AI_MODELS];
    const provider = modelConfig?.apiProvider || "nvidia";
    if (!user) {
      openAuth();
      return;
    }
    const hasKey = getKey(provider);
    if (!hasKey) {
      onApiKeyNeeded(provider);
      return;
    }
    const newParams = new URLSearchParams(searchParams);
    newParams.set("model", value);
    newParams.set("provider", provider);
    setSearchParams(newParams);
  };

  const providerModels = Object.entries(AI_MODELS).filter(
    ([_, model]) => model.apiProvider === currentProvider
  );

  return (
    <>
      <div className="fixed top-0 left-0 w-full px-4 py-3 md:py-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 z-50 select-none cursor-default glass-header transition-all">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="font-semibold text-sm sm:text-base md:text-xl text-slate-800 dark:text-slate-100 tracking-tight">
            interpreter AI
          </div>
          <img src="/favicon.ico" alt="Interpreter AI icon" className="w-5 h-5 sm:w-7 sm:h-7 md:w-9 md:h-9 object-contain" />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="relative flex items-center gap-1.5 group">
            <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">AI</span>
            <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>

            <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-slate-800 text-slate-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
              <div className="font-semibold mb-1 text-slate-50 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Providers & Models
              </div>
              Select your preferred AI provider and model. Open-source neural network models vary in inference speed and translation accuracy.
              <div className="absolute top-0 right-[7.5rem] -mt-1.5 w-3 h-3 bg-slate-800 transform rotate-45"></div>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={currentProvider}
              onChange={(e) => {
                const newProvider = e.target.value;
                const newParams = new URLSearchParams(searchParams);
                newParams.set("provider", newProvider);
                if (newProvider === "nvidia") {
                  newParams.set("model", "nvidia-diffusiongemma");
                } else if (newProvider === "google") {
                  newParams.set("model", "google-gemini-3-5-flash");
                } else if (newProvider === "openai") {
                  newParams.set("model", "openai-gpt-4o-mini");
                } else if (newProvider === "anthropic") {
                  newParams.set("model", "anthropic-haiku-4-5");
                } else {
                  newParams.delete("model");
                }
                setSearchParams(newParams);
              }}
              className="glass-select text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-400 shadow-sm font-sans max-w-[100px] sm:max-w-none truncate transition-colors cursor-pointer"
            >
              <option value="nvidia">NVIDIA</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>

            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setModelMenuOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={modelMenuOpen}
                className="glass-select flex items-center gap-1.5 h-[26px] max-w-[190px] text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2 outline-none focus:border-blue-400 shadow-sm font-sans transition-colors cursor-pointer"
              >
                <span className={`grid place-items-center w-4 h-4 shrink-0 rounded-full ${isThinker ? "text-indigo-500 dark:text-indigo-400" : "text-sky-500 dark:text-sky-400"}`}>
                  {isThinker ? <BrainIcon size={11} /> : <ZapIcon size={11} />}
                </span>
                <span className="truncate font-medium">{currentModelInfo?.name || "Model"}</span>
                <span className={`shrink-0 grid place-items-center text-slate-400 transition-transform duration-200 ${modelMenuOpen ? "rotate-180" : ""}`}>
                  <ChevronDownIcon size={12} />
                </span>
              </button>

              {modelMenuOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 top-full mt-2 w-72 p-1.5 rounded-xl glass-panel z-[60] animate-fadeIn flex flex-col gap-0.5"
                >
                  {providerModels.map(([key, model]) => {
                    const thinker = model.reasoning ?? isReasoningModel(model.id);
                    const active = key === currentModel;
                    return (
                      <button
                        key={key}
                        role="option"
                        aria-selected={active}
                        onClick={() => selectModel(key)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                          active
                            ? "bg-indigo-500/10 dark:bg-sky-400/10"
                            : "hover:bg-slate-500/10 dark:hover:bg-slate-400/10"
                        }`}
                      >
                        <span
                          className={`grid place-items-center w-6 h-6 shrink-0 rounded-md ring-1 ${
                            thinker
                              ? "bg-indigo-500/10 text-indigo-500 ring-indigo-500/25 dark:text-indigo-400 dark:ring-indigo-400/25"
                              : "bg-sky-500/10 text-sky-500 ring-sky-500/25 dark:text-sky-400 dark:ring-sky-400/25"
                          }`}
                        >
                          {thinker ? <BrainIcon size={12} /> : <ZapIcon size={12} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className={`block truncate text-xs ${
                              active
                                ? "font-semibold text-slate-800 dark:text-slate-100"
                                : "font-medium text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {model.name}
                          </span>
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                            {thinker ? "Thinker · chain of thought" : "Instant · low latency"}
                          </span>
                        </span>
                        {active && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-500 dark:text-sky-400">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  <div className="h-px my-1 bg-slate-500/15 dark:bg-slate-400/15"></div>
                  <button
                    onClick={() => {
                      setModelMenuOpen(false);
                      onOpenApiSettings();
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-500/10 dark:hover:bg-slate-400/10 transition-colors"
                  >
                    <KeyIcon /> API Keys
                  </button>
                </div>
              )}
            </div>

            {currentModelInfo && (
              <span
                title={isThinker ? "Razona en cadena de pensamiento oculta (más latencia)" : "Responde al instante, sin thinking (menos latencia)"}
                className={`inline-flex items-center justify-center gap-1 h-[26px] px-2.5 rounded-full text-[10px] font-semibold uppercase tracking-wider leading-none whitespace-nowrap shrink-0 backdrop-blur-md ring-1 ${
                  isThinker
                    ? "bg-indigo-500/10 text-indigo-600 ring-indigo-500/30 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/25"
                    : "bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25"
                }`}
              >
                {isThinker ? <BrainIcon size={11} /> : <ZapIcon size={11} />}
                {isThinker ? "Thinker" : "Instant"}
              </span>
            )}
          </div>

          <div className="relative group">
            <button
              onClick={openHistory}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Ver historial"
            >
              <HistoryIcon />
            </button>
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg border border-slate-700 dark:border-slate-600">
              History
            </div>
          </div>

          <div className="relative group">
            <button
              onClick={toggleDark}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg border border-slate-700 dark:border-slate-600">
              {isDark ? "Light mode" : "Dark mode"}
            </div>
          </div>

          {user ? (
            <UserAvatar user={user} onOpenApiSettings={onOpenApiSettings} onOpenFeedback={onOpenFeedback} />
          ) : (
            <div className="relative group">
              <button
                onClick={openAuth}
                className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Iniciar sesión"
              >
                <UserIcon />
              </button>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg border border-slate-700 dark:border-slate-600">
                Iniciar sesión
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Header;
