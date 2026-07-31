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
import { useAuth, AuthProvider } from "contexts/AuthContext";
import type { User } from "@supabase/supabase-js";
import { message } from "antd";
import { syncRegionsFromSupabase } from "./utils/mapeoLocales";

import Header from "./components/Header";

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
    if (user) syncRegionsFromSupabase(user.id);
  }, [user]);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-x-hidden">
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
              <div className="text-center text-[#111111] dark:text-slate-100 h-[calc(100vh-5rem)] sm:h-[calc(100vh-5.5rem)] md:h-[calc(100vh-6rem)] w-[95%] md:w-[97%] bg-white dark:bg-slate-800 rounded-2xl mx-auto mt-16 sm:mt-[4.5rem] md:mt-[5rem] overflow-hidden flex flex-col font-sans shadow-lg border border-slate-200/50 dark:border-slate-700/50 transition-colors duration-200">
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
      </div>
    </Router>
  );
}

export default App;