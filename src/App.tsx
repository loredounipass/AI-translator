import { useState, useEffect } from "react";
import React from "react";
import LanguagesBar from "./components/LanguagesBar";
import TranslationTextField from "./components/TranslationTextField";
import { BrowserRouter as Router, Route, Routes, useSearchParams } from "react-router-dom";
import TranslatedText from "components/TranslatedText";
import HistoryPanel from "./components/HistoryPanel";
import AuthModal from "./components/AuthModal";
import ApiKeyModal from "./components/ApiKeyModal";
import ApiSettingsModal from "./components/ApiSettingsModal";
import UserAvatar from "./components/UserAvatar";
import { AI_MODELS, DEFAULT_MODEL } from "utils/constants";
import { Analytics } from "@vercel/analytics/react";
import { useAuth } from "hooks/useAuth";
import { ApiKeyProvider, useApiKey } from "./contexts/ApiKeyContext";
import type { User } from "@supabase/supabase-js";
import { message } from "antd";

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

const Header = ({
  isDark,
  toggleDark,
  openHistory,
  openAuth,
  user,
  onApiKeyNeeded,
  onOpenApiSettings,
}: {
  isDark: boolean;
  toggleDark: () => void;
  openHistory: () => void;
  openAuth: () => void;
  user: User | null;
  onApiKeyNeeded: (provider: string) => void;
  onOpenApiSettings: () => void;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentModel = searchParams.get("model") || DEFAULT_MODEL;
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
      <div className="fixed top-0 left-0 w-full p-4 md:top-4 md:p-0 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 z-50 select-none cursor-default bg-white/90 dark:bg-slate-900/90 md:bg-transparent md:dark:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200 dark:border-slate-800 md:border-none md:dark:border-none shadow-sm md:shadow-none transition-all">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-lg md:text-xl text-slate-800 dark:text-slate-100 tracking-tight">
            interpreter AI
          </div>
          <img src="/favicon.ico" alt="Interpreter AI icon" className="w-10 h-10 object-contain" />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5 group">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">AI model</span>
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
                Attention
              </div>
              These open-source neural network models vary in inference speed and translation accuracy. <strong className="text-slate-100 font-medium">Mistral</strong> and <strong className="text-slate-100 font-medium">Llama</strong> offer the fastest response times, while Mistral typically delivers the highest quality results for this application.
              <div className="absolute top-0 right-[7.5rem] -mt-1.5 w-3 h-3 bg-slate-800 transform rotate-45"></div>
            </div>
          </div>
          <select
            value={currentModel}
            onChange={handleModelChange}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-blue-400 shadow-sm font-sans max-w-[120px] sm:max-w-none truncate transition-colors"
          >
            {Object.entries(AI_MODELS).map(([key, model]) => (
              <option key={key} value={key}>
                {model.name}
              </option>
            ))}
            <option value="__settings__">── API Keys ──</option>
          </select>

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
            <UserAvatar user={user} onOpenApiSettings={onOpenApiSettings} />
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

function App() {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch (e) {
      return false;
    }
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState("nvidia");
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const prevUserRef = React.useRef(user);
  useEffect(() => {
    if (prevUserRef.current && !user) {
      setIsApiKeyOpen(false);
      setIsApiSettingsOpen(false);
      setIsHistoryOpen(false);
    }
    prevUserRef.current = user;
  }, [user]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).catch(() => {});
  }, []);

  useEffect(() => {
    const msg = sessionStorage.getItem("app_toast");
    if (msg) {
      sessionStorage.removeItem("app_toast");
      message.success(msg);
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-x-hidden">
        <ApiKeyProvider>
        <Header
          isDark={isDark}
          toggleDark={() => setIsDark(!isDark)}
          openHistory={() => setIsHistoryOpen(true)}
          openAuth={() => setIsAuthOpen(true)}
          user={user}
          onApiKeyNeeded={(provider) => { setPendingProvider(provider); setIsApiKeyOpen(true); }}
          onOpenApiSettings={() => setIsApiSettingsOpen(true)}
        />
        <HistoryPanel isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
        {user && (
          <ApiKeyModal
            isOpen={isApiKeyOpen}
            onClose={() => setIsApiKeyOpen(false)}
            userId={user.id}
            provider={pendingProvider}
          />
        )}
        {user && (
          <ApiSettingsModal
            isOpen={isApiSettingsOpen}
            onClose={() => setIsApiSettingsOpen(false)}
            userId={user.id}
          />
        )}
        <Routes>
          <Route
            path="/"
            element={
              <div className="text-center text-[#111111] dark:text-slate-100 h-[calc(100vh-8rem)] md:h-[calc(90vh-1rem)] w-[95%] md:w-[97%] bg-white dark:bg-slate-800 rounded-2xl mx-auto mt-28 md:mt-[10vh] overflow-hidden flex flex-col font-sans shadow-lg border border-slate-200/50 dark:border-slate-700/50 transition-colors duration-200">
                <LanguagesBar />
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  <TranslationTextField />
                  <TranslatedText />
                </div>
              </div>
            }
          />
        </Routes>
        <Analytics />
      </ApiKeyProvider>
      </div>
    </Router>
  );
}

export default App;