import { useState, useEffect } from "react";
import { message } from "antd";
import { apiKeyService } from "../utils/apiKeyService";
import { API_PROVIDERS, useApiKey } from "../contexts/ApiKeyContext";

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {visible ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const maskKey = (key: string): string => {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
};

const ApiSettingsModal = ({ isOpen, onClose, userId }: ApiSettingsModalProps) => {
  const { setKey, removeKey, allKeys } = useApiKey();
  const [editProvider, setEditProvider] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEditProvider(null);
      setInputValue("");
      setShowInput(false);
    }
  }, [isOpen]);

  const handleSave = async (provider: string) => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await apiKeyService.upsert(userId, provider, trimmed);
      setKey(provider, trimmed);
      message.success(`API key de ${API_PROVIDERS.find((p) => p.id === provider)?.name || provider} guardada`);
      setEditProvider(null);
      setInputValue("");
      setShowInput(false);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: string) => {
    setSaving(true);
    try {
      await apiKeyService.remove(userId, provider);
      removeKey(provider);
      message.success(`API key de ${API_PROVIDERS.find((p) => p.id === provider)?.name || provider} eliminada`);
      if (editProvider === provider) {
        setEditProvider(null);
        setInputValue("");
        setShowInput(false);
      }
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (provider: string) => {
    setEditProvider(provider);
    setInputValue("");
    setShowInput(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[65] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-fadeIn">
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
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
                          className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors font-mono"
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
                      className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
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
