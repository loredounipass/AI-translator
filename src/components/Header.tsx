import React from "react";
import { useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { AI_MODELS, DEFAULT_MODEL } from "utils/constants";
import { useApiKey } from "contexts/ApiKeyContext";
import UserAvatar from "./UserAvatar";

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

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

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "__settings__") {
      onOpenApiSettings();
      setTimeout(() => {
        const el = e.target as HTMLSelectElement;
        el.value = currentModel;
      }, 0);
      return;
    }
    const modelConfig = AI_MODELS[e.target.value as keyof typeof AI_MODELS];
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
    newParams.set("model", e.target.value);
    setSearchParams(newParams);
  };

  return (
    <>
      <div className="fixed top-0 left-0 w-full p-2 sm:p-4 md:top-4 md:p-0 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-3 z-50 select-none cursor-default bg-white/90 dark:bg-slate-900/90 md:bg-transparent md:dark:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200 dark:border-slate-800 md:border-none md:dark:border-none shadow-sm md:shadow-none transition-all">
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
                  newParams.set("model", DEFAULT_MODEL);
                } else if (newProvider === "google") {
                  newParams.set("model", "google-gemini-flash");
                } else {
                  newParams.delete("model");
                }
                setSearchParams(newParams);
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-blue-400 shadow-sm font-sans max-w-[100px] sm:max-w-none truncate transition-colors"
            >
              <option value="nvidia">NVIDIA</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>

            <select
              value={(currentProvider === "nvidia" || currentProvider === "google") ? (currentModel || "") : "coming_soon"}
              onChange={handleModelChange}
              disabled={currentProvider !== "nvidia" && currentProvider !== "google"}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-blue-400 shadow-sm font-sans max-w-[120px] sm:max-w-none truncate transition-colors disabled:opacity-50 disabled:bg-slate-50 disabled:dark:bg-slate-800/50"
            >
              {currentProvider === "nvidia" || currentProvider === "google" ? (
                <>
                  {Object.entries(AI_MODELS).filter(([_, model]) => model.apiProvider === currentProvider).map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.name}
                    </option>
                  ))}
                  <option value="__settings__">── API Keys ──</option>
                </>
              ) : (
                <option value="coming_soon" disabled>Coming soon...</option>
              )}
            </select>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
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
