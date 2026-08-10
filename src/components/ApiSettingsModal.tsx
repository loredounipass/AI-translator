import React from "react";
import { API_PROVIDERS } from "../contexts/ApiKeyContext";
import { useApiSettingsModalLogic } from "../hooks/useApiSettingsModalLogic";
import { KeyIcon, EyeIcon, CheckIcon, TrashIcon, ExternalLinkIcon, CloseIcon } from "./icons";

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}



const maskKey = (key: string): string => {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
};

const ApiSettingsModal = ({ isOpen, onClose, userId }: ApiSettingsModalProps) => {
  const {
    editProvider,
    setEditProvider,
    inputValue,
    setInputValue,
    showInput,
    setShowInput,
    saving,
    allKeys,
    handleSave,
    handleDelete,
    startEdit,
  } = useApiSettingsModalLogic({ isOpen, onClose, userId });

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 glass-overlay z-[65] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="glass-modal rounded-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <KeyIcon />
              API Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Cerrar"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 pb-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your API keys for each provider. Keys are stored securely and used only for your requests.
            </p>
          </div>

          <div className="px-5 pb-5 space-y-3 max-h-[60vh] overflow-y-auto blue-scrollbar">
            {API_PROVIDERS.map((provider) => {
              const hasKey = !!allKeys[provider.id];
              const isEditing = editProvider === provider.id;

              return (
                <div
                  key={provider.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {provider.name}
                      </span>
                      {hasKey ? (
                        <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <CheckIcon />
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                          Not set
                        </span>
                      )}
                    </div>
                    <a
                      href={provider.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      Get key
                      <ExternalLinkIcon />
                    </a>
                  </div>

                  {hasKey && !isEditing && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-slate-500 dark:text-slate-400">
                        {showInput && editProvider === provider.id
                          ? inputValue
                          : maskKey(allKeys[provider.id])}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setShowInput(!showInput);
                            if (editProvider !== provider.id) {
                              startEdit(provider.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label="Mostrar key"
                        >
                          <EyeIcon visible={showInput && editProvider === provider.id} />
                        </button>
                        <button
                          onClick={() => startEdit(provider.id)}

                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          aria-label="Editar key"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(provider.id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          aria-label="Eliminar key"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <KeyIcon />
                        </div>
                        <input
                          type={showInput ? "text" : "password"}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder={`${provider.keyPrefix}...`}
                          className="w-full pl-10 pr-10 py-2 rounded-lg glass-input text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors font-mono"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowInput(!showInput)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          aria-label={showInput ? "Ocultar key" : "Mostrar key"}
                        >
                          <EyeIcon visible={showInput} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(provider.id)}
                          disabled={saving}
                          className="flex-1 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? "Guardando..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditProvider(null);
                            setInputValue("");
                            setShowInput(false);
                          }}
                          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasKey && !isEditing && (
                    <button
                      onClick={() => startEdit(provider.id)}
                      className="w-full py-2 rounded-lg border border-dashed text-sm font-medium transition-colors border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400"
                    >
                      + Add API Key
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default ApiSettingsModal;
