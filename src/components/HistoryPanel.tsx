import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { historyService } from "utils/historyService";
import type { HistoryItem } from "utils/historyService";
import { translationMemory } from "api/translation/translationMemory";
import { clearTranslationCache } from "api/translation/cache";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryPanel = ({ isOpen, onClose }: HistoryPanelProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const loadHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    const data = await historyService.getAll(user.id);
    setHistory(data);
  }, [user]);

  useEffect(() => {
    if (isOpen) loadHistory();
  }, [isOpen, loadHistory]);

  useEffect(() => {
    if (!user) return;
    loadHistory();
    window.addEventListener("historyUpdated", loadHistory);
    return () => window.removeEventListener("historyUpdated", loadHistory);
  }, [user, loadHistory]);

  const clearHistory = async () => {
    if (!user) return;
    await historyService.clearAll(user.id);
    setHistory([]);
    setShowClearConfirm(false);

    // Fresh start: clear all in-memory translation layers
    translationMemory.clear();
    clearTranslationCache();
  };

  const deleteItem = async (id: string) => {
    if (!user) return;

    // Find the item before removing so we can clean memory/cache
    const item = history.find((h) => h.id === id);
    
    await historyService.delete(id, user.id);
    setHistory((prev) => prev.filter((item) => item.id !== id));

    // Remove from in-memory translation layers
    if (item) {
      translationMemory.remove(item.source_text);
    }
  };

  const toggleFavorite = async (id: string, current: boolean) => {
    if (!user) return;
    await historyService.toggleFavorite(id, !current, user.id);
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_favorite: !current } : item
      )
    );
  };

  const handleRestore = (sourceText: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("text", sourceText);
    setSearchParams(newParams);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 glass-overlay z-[55] transition-opacity duration-300 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed top-0 left-0 h-full w-80 md:w-96 glass-panel z-[60] transform transition-transform duration-300 ease-in-out flex flex-col rounded-r-2xl ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/30 dark:border-slate-700/30 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Historial
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar historial"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {!user ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 dark:text-slate-400 font-medium">Inicia sesión para ver tu historial</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">No hay traducciones recientes</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Tu historial de traducción aparecerá aquí.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end mb-1">
                {showClearConfirm ? (
                  <div className="flex items-center gap-3 text-xs bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded text-slate-700 dark:text-slate-300">
                    <span>Are you sure you want to delete?</span>
                    <button onClick={clearHistory} className="font-bold text-red-600 dark:text-red-400 hover:underline">Yes</button>
                    <button onClick={() => setShowClearConfirm(false)} className="font-medium text-slate-500 dark:text-slate-400 hover:underline">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-500 dark:hover:text-red-400 font-medium transition-colors"
                  >
                    Borrar historial
                  </button>
                )}
              </div>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleRestore(item.source_text)}
                  className={`relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-3 rounded-xl shadow-sm border ${item.is_favorite ? "border-yellow-400/40 dark:border-yellow-500/40" : "border-white/40 dark:border-slate-700/30"} text-left animate-fadeIn cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-500/50 transition-colors group`}
                >
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id, item.is_favorite);
                      }}
                      className={`p-1 rounded transition-all ${item.is_favorite ? "text-yellow-400 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-slate-400 dark:text-slate-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"}`}
                      aria-label="Favorito"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={item.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteItem(item.id);
                      }}
                      className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      aria-label="Eliminar traducción"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1 pr-14 line-clamp-1 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">{item.source_text}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 font-medium line-clamp-3 pr-10">{item.translated_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HistoryPanel;