import { useState } from "react";
import { apiKeyService } from "../utils/apiKeyService";
import { API_PROVIDERS, useApiKey } from "../contexts/ApiKeyContext";
import { showSuccessToast, showErrorToast } from "../components/AppNotifications";

interface UseApiKeyModalLogicProps {
  userId: string;
  provider: string;
  onClose: () => void;
}



// MAIN HOOK FOR API KEY MODAL LOGIC
export const useApiKeyModalLogic = ({ userId, provider, onClose }: UseApiKeyModalLogicProps) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setKey } = useApiKey();



  // HANDLE SAVE API KEY TO DATABASE AND LOCAL CONTEXT
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await apiKeyService.upsert(userId, provider, trimmed);
      setKey(provider, trimmed);
      showSuccessToast(`API key de ${API_PROVIDERS.find((p) => p.id === provider)?.name || provider} guardada`);
      setApiKey("");
      onClose();
    } catch (err) {
      showErrorToast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return {
    apiKey,
    setApiKey,
    showKey,
    setShowKey,
    saving,
    handleSave,
  };
};
