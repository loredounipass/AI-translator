import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { historyService } from "utils/historyService";
import type { HistoryItem } from "utils/historyService";
import { translationMemory } from "api/translation/translationMemory";
import { clearTranslationCache, removeFromCacheByPair } from "api/translation/cache";
import { showHistoryLimitNotification } from "./AppNotifications";
import AddInterpretationModal from "./AddInterpretationModal";
import { Virtuoso } from "react-virtuoso";
import HistoryItemCard from "./HistoryItemCard";
import { debounce } from "lodash";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryPanel = ({ isOpen, onClose }: HistoryPanelProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const historyLoadedRef = useRef(false);

  const loadHistory = useCallback(async (force = false) => {
    if (!user) {
      setHistory([]);
      return;
    }
    // Si no estamos forzando (force=false), ya cargamos, y hay historial, evitamos el refetch.
    if (!force && historyLoadedRef.current) return;
    
    const data = await historyService.getAll(user.id);
    
    // Check limit
    if (data.length >= 300) {
      showHistoryLimitNotification();
    }
    
    setHistory(data);
    historyLoadedRef.current = true;
  }, [user]);

  useEffect(() => {
    if (isOpen) loadHistory(false);
  }, [isOpen, loadHistory]);

  useEffect(() => {
    if (!user) {
      historyLoadedRef.current = false;
      return;
    }
    // Only load if it's not already loaded
    loadHistory(false);
    
    // Use debounce to prevent spamming the server when multiple updates occur quickly
    const handleHistoryUpdate = debounce(() => loadHistory(true), 1000); 
    window.addEventListener("historyUpdated", handleHistoryUpdate);
    return () => {
      handleHistoryUpdate.cancel();
      window.removeEventListener("historyUpdated", handleHistoryUpdate);
    };
  }, [user, loadHistory]);

  const clearHistory = async () => {
    if (!user) return;
    await historyService.clearAll(user.id);
    setHistory([]);
    setShowClearConfirm(false);
    historyLoadedRef.current = false; // Reset ref

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

    // Remove from in-memory translation layers (exact language pair only)
    if (item) {
      translationMemory.remove(
        item.source_text,
        item.source_lang,
        item.target_lang
      );
      removeFromCacheByPair(
        item.source_text,
        item.target_lang,
        item.source_lang
      );
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

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setIsAddModalOpen(true);
  };

  const handleEditItem = (item: HistoryItem) => {
    setEditingItem(item);
  };

  const handleInterpretationAdded = () => {
    loadHistory(true);
    // Dispatch event to notify other components
    window.dispatchEvent(new Event("historyUpdated"));
  };

  return (
    <>
      {/* Add/Edit Interpretation Modal */}
      <AddInterpretationModal
        isOpen={isAddModalOpen || !!editingItem}
        onClose={closeModal}
        editingItem={editingItem}
        onInterpretationAdded={handleInterpretationAdded}
      />

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
          <div className="flex items-center gap-1">
            {/* Add Interpretation Button */}
            {user && (
              <button
                onClick={openAddModal}
                className="p-1.5 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                aria-label="Agregar interpretación"
                title="Agregar interpretación"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>
            )}
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
            <div className="flex flex-col h-full">
              <div className="flex justify-end mb-2 shrink-0">
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
              <div className="flex-1 overflow-hidden min-h-0 relative -mr-2 pr-2">
                <Virtuoso
                  data={history}
                  className="custom-scrollbar"
                  style={{ height: '100%', width: '100%' }}
                  itemContent={(_index, item) => (
                    <div className="pb-3">
                      <HistoryItemCard
                        item={item}
                        onRestore={handleRestore}
                        onEdit={handleEditItem}
                        onToggleFavorite={toggleFavorite}
                        onDelete={deleteItem}
                      />
                    </div>
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HistoryPanel;