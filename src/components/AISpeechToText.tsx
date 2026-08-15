import React, { useEffect } from "react";
import MicIcon from "../assets/MicIcon";
import PauseIcon from "../assets/PauseIcon";
import { showErrorToast } from "./AppNotifications";
import GlassTooltip from "./GlassTooltip";

interface AISpeechToTextProps {
  aiEnabled: boolean;
  onToggle: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  isVoiceActive: boolean;
  captureSystemAudio: boolean;
  onToggleSystemAudio: () => void;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const AI_MODELS = [
  { value: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "Nemotron Omni 30B", shortLabel: "Nemotron Omni" },
  { value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", shortLabel: "Gemini Flash" },
  { value: "google/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", shortLabel: "Gemini Lite" },
];

const ToggleSwitch = ({ checked, onChange, tooltip, disabled }: { checked: boolean; onChange: () => void; tooltip: string; disabled?: boolean }) => (
  <GlassTooltip label={tooltip}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={tooltip}
      onClick={onChange}
      disabled={disabled}
      className={`w-11 h-6 rounded-full border-none relative cursor-pointer p-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-blue-500" : "bg-black dark:bg-slate-600"
      }`}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  </GlassTooltip>
);

const AISpeechToText = ({
  aiEnabled,
  onToggle,
  isRecording,
  isProcessing,
  isVoiceActive,
  captureSystemAudio,
  onToggleSystemAudio,
  error,
  onStartRecording,
  onStopRecording,
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
          {AI_MODELS.map((model) => (
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
          tooltip="System Audio" 
        />
      )}

      {aiEnabled && (
        <>
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop AI recording" : "Start AI recording"}
            className="bg-none border-none cursor-pointer p-1 transition-all duration-200 text-[#111] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-105 shrink-0"
          >
            {isRecording ? <PauseIcon size={30} /> : <MicIcon size={30} />}
          </button>
        </>
      )}
    </div>
  );
};

export default AISpeechToText;
