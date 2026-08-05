import { useState, useEffect } from "react";
import { apiKeyService } from "../utils/apiKeyService";
import { API_PROVIDERS, useApiKey } from "../contexts/ApiKeyContext";
import { showSuccessToast, showErrorToast } from "../components/AppNotifications";

interface UseApiSettingsModalLogicProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}



// MAIN HOOK FOR API SETTINGS MODAL LOGIC
export const useApiSettingsModalLogic = ({ isOpen, onClose, userId }: UseApiSettingsModalLogicProps) => {
  const { setKey, removeKey, allKeys } = useApiKey();
  const [editProvider, setEditProvider] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);



  // RESET STATE WHEN MODAL CLOSES
  useEffect(() => {
    if (!isOpen) {
      setEditProvider(null);
      setInputValue("");
      setShowInput(false);
    }
  }, [isOpen]);



  // HANDLE SAVE OR UPDATE API KEY
  const handleSave = async (provider: string) => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await apiKeyService.upsert(userId, provider, trimmed);
      setKey(provider, trimmed);
      showSuccessToast(`API key de ${API_PROVIDERS.find((p) => p.id === provider)?.name || provider} guardada`);
      setEditProvider(null);
      setInputValue("");
      setShowInput(false);
    } catch (err) {
      showErrorToast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };



  // HANDLE DELETE API KEY
  const handleDelete = async (provider: string) => {
    setSaving(true);
    try {
      await apiKeyService.remove(userId, provider);
      removeKey(provider);
      showSuccessToast(`API key de ${API_PROVIDERS.find((p) => p.id === provider)?.name || provider} eliminada`);
      if (editProvider === provider) {
        setEditProvider(null);
        setInputValue("");
        setShowInput(false);
      }
    } catch (err) {
      showErrorToast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };



  // START EDITING API KEY FOR A SPECIFIC PROVIDER
  const startEdit = (provider: string) => {
    setEditProvider(provider);
    setInputValue("");
    setShowInput(false);
  };

  return {
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
  };
};
