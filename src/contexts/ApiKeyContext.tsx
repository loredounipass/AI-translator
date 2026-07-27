import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiKeyService, type ApiKeyRow } from "../utils/apiKeyService";
import { useAuth } from "hooks/useAuth";

export const API_PROVIDERS = [
  { id: "nvidia", name: "NVIDIA", keyPrefix: "nvapi-", docUrl: "https://build.nvidia.com/" },
  { id: "openai", name: "OpenAI", keyPrefix: "sk-", docUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic", keyPrefix: "sk-ant-", docUrl: "https://console.anthropic.com/settings/keys" },
] as const;

export type ProviderId = (typeof API_PROVIDERS)[number]["id"];

interface ApiKeyContextValue {
  getKey: (provider: string) => string | null;
  setKey: (provider: string, key: string) => void;
  removeKey: (provider: string) => void;
  fetchKeys: () => Promise<void>;
  allKeys: Record<string, string>;
  keysLoaded: boolean;
  keysLoading: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextValue>({
  getKey: () => null,
  setKey: () => {},
  removeKey: () => {},
  fetchKeys: async () => {},
  allKeys: {},
  keysLoaded: false,
  keysLoading: false,
});

export const ApiKeyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [keysLoading, setKeysLoading] = useState(true); // true desde el inicio para bloquear hasta que la carga real termine

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    setKeysLoaded(false);
    if (!user) {
      setKeys({});
      setKeysLoaded(true);
      setKeysLoading(false);
      return;
    }
    const rows = await apiKeyService.getAll(user.id);
    const mapped: Record<string, string> = {};
    for (const row of rows) {
      mapped[row.provider] = row.api_key;
    }
    setKeys(mapped);
    setKeysLoaded(true);
    setKeysLoading(false);
  }, [user]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const getKey = useCallback(
    (provider: string): string | null => keys[provider] || null,
    [keys]
  );

  const setKey = useCallback(
    (provider: string, key: string) => {
      setKeys((prev) => ({ ...prev, [provider]: key }));
    },
    []
  );

  const removeKey = useCallback(
    (provider: string) => {
      setKeys((prev) => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    },
    []
  );

  return (
    <ApiKeyContext.Provider value={{ getKey, setKey, removeKey, fetchKeys, allKeys: keys, keysLoaded, keysLoading }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => useContext(ApiKeyContext);
