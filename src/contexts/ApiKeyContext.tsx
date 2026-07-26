import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiKeyService } from "../utils/apiKeyService";
import { useAuth } from "hooks/useAuth";

interface ApiKeyContextValue {
  getKey: (provider: string) => string | null;
  setKey: (provider: string, key: string) => void;
  fetchKeys: () => Promise<void>;
}

const ApiKeyContext = createContext<ApiKeyContextValue>({
  getKey: () => null,
  setKey: () => {},
  fetchKeys: async () => {},
});

export const ApiKeyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Record<string, string>>({});

  const fetchKeys = useCallback(async () => {
    if (!user) {
      setKeys({});
      return;
    }
    const nvidiaKey = await apiKeyService.get(user.id, "nvidia");
    setKeys((prev) => ({ ...prev, nvidia: nvidiaKey || "" }));
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

  return (
    <ApiKeyContext.Provider value={{ getKey, setKey, fetchKeys }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => useContext(ApiKeyContext);
