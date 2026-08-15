import React, { useEffect } from "react";
import { showErrorToast } from "./AppNotifications";
import { AI_TRANSCRIPTION_MODELS } from "../utils/AITranscriptionModels";
import { ToggleSwitch } from "./SpeechControls";

interface AISpeechToTextProps {
  aiEnabled: boolean;
  onToggle: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  captureSystemAudio: boolean;
  onToggleSystemAudio: () => void;
  error: string | null;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const AISpeechToText = ({
  aiEnabled,
  onToggle,
  isRecording,
  isProcessing,
  captureSystemAudio,
  onToggleSystemAudio,
  error,
  selectedModel,
  onModelChange,
}: AISpeechToTextProps) => {

  useEffect(() => {
    if (error && !isRecording) {
      showErrorToast("Error", error);
    }
  }, [error, isRecording]);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-0 w-full sm:w-auto">
      <ToggleSwitch checked={aiEnabled} onChange={onToggle} tooltip="AI Transcription" />
      
      {aiEnabled && (
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={isRecording || isProcessing}
          className="glass-select text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-400 shadow-sm font-sans w-32 truncate transition-colors cursor-pointer"
        >
          {AI_TRANSCRIPTION_MODELS.map((model) => (
            <option key={model.value} value={model.value}>
              {model.shortLabel}
            </option>
          ))}
        </select>
      )}

      {aiEnabled && (
        <ToggleSwitch 
          checked={captureSystemAudio} 
          onChange={onToggleSystemAudio} 
          tooltip="Capturar Audio de Pestaña" 
        />
      )}
    </div>
  );
};

export default AISpeechToText;
