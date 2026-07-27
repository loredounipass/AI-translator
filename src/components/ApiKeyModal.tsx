import { useState } from "react";
import { message } from "antd";
import { apiKeyService } from "../utils/apiKeyService";
import { API_PROVIDERS, useApiKey } from "../contexts/ApiKeyContext";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  provider?: string;
}

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const ApiKeyModal = ({ isOpen, onClose, userId, provider = "nvidia" }: ApiKeyModalProps) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setKey } = useApiKey();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      message.warning("Ingresa tu API key");
      return;
    }

    setSaving(true);
    try {
      await apiKeyService.upsert(userId, provider, trimmed);
      setKey(provider, trimmed);
      message.success(`API key de ${API_PROVIDERS.find((p) => p.id === provider)?.name || provider} guardada`);
      setApiKey("");
      onClose();
    } catch {
      message.error("Error al guardar la API key");
    } finally {
      setSaving(false);
    }
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              API Key — {API_PROVIDERS.find((p) => p.id === provider)?.name || provider}
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
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Este modelo requiere una API key de <strong className="text-slate-700 dark:text-slate-300">{API_PROVIDERS.find((p) => p.id === provider)?.name || provider}</strong>.
              Ingresa tu clave para usar tus propios recursos.
            </p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyIcon />
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${API_PROVIDERS.find((p) => p.id === provider)?.keyPrefix || "key"}...`}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors font-mono"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label={showKey ? "Ocultar key" : "Mostrar key"}
              >
                <EyeIcon visible={showKey} />
              </button>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Guardando..." : "Guardar API Key"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ApiKeyModal;
