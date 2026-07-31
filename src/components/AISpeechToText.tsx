import React, { useEffect } from "react";
import { Select, message } from "antd";
import MicIcon from "../assets/MicIcon";
import PauseIcon from "../assets/PauseIcon";

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
  // { value: "nvidia/canary-1b-asr", label: "Canary 1B ASR", shortLabel: "Canary 1B" },
];

const ToggleSwitch = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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
    <span className="text-[#333] dark:text-slate-300 text-xs whitespace-nowrap cursor-pointer select-none" onClick={!disabled ? onChange : undefined}>
      {label}
    </span>
  </div>
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
      message.error(error);
    }
  }, [error, isRecording]);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-0 w-full sm:w-auto">
      <ToggleSwitch checked={aiEnabled} onChange={onToggle} label="AI STT" />
      
      {aiEnabled && (
        <Select
          value={selectedModel}
          onChange={onModelChange}
          options={AI_MODELS}
          optionLabelProp="shortLabel"
          size="small"
          className="w-24 text-xs"
          popupMatchSelectWidth={false}
          disabled={isRecording || isProcessing}
        />
      )}

      {aiEnabled && (
        <ToggleSwitch 
          checked={captureSystemAudio} 
          onChange={onToggleSystemAudio} 
          label="System Audio" 
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
