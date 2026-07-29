import React from "react";
import { Select } from "antd";
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
  { value: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "Nemotron Omni 30B" },
];

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
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={aiEnabled}
        aria-label="Toggle AI Speech-to-Text"
        onClick={onToggle}
        className={`w-11 h-6 rounded-full border-none relative cursor-pointer p-0 transition-colors ${
          aiEnabled ? "bg-blue-500" : "bg-black dark:bg-slate-600"
        }`}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: aiEnabled ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </button>
      <span className="text-[#333] dark:text-slate-300 text-xs whitespace-nowrap">
        AI STT
      </span>
      
      {aiEnabled && (
        <Select
          value={selectedModel}
          onChange={onModelChange}
          options={AI_MODELS}
          size="small"
          className="w-40 ml-1 text-xs"
          popupMatchSelectWidth={false}
          disabled={isRecording || isProcessing}
        />
      )}

      {aiEnabled && (
        <label className="flex items-center gap-1 cursor-pointer ml-1 text-xs text-[#333] dark:text-slate-300 hover:text-blue-500 transition-colors" title="Capturar audio interno de Zoom/Llamadas">
          <input 
            type="checkbox" 
            checked={captureSystemAudio} 
            onChange={onToggleSystemAudio} 
            disabled={isRecording || isProcessing}
            className="cursor-pointer"
          />
          Mix System Audio
        </label>
      )}

      {aiEnabled && (
        <>
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop AI recording" : "Start AI recording"}
            className="bg-none border-none cursor-pointer p-1 transition-all duration-200 text-[#111] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-105"
          >
            {isRecording ? <PauseIcon size={30} /> : <MicIcon size={30} />}
          </button>
          {isRecording && (
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                  isVoiceActive
                    ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                    : "bg-red-400 animate-pulse"
                }`}
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                {isVoiceActive ? "Listening..." : "Waiting for voice..."}
              </span>
            </span>
          )}
          {isProcessing && (
            <span className="text-xs text-blue-500 animate-pulse">Transcribing...</span>
          )}
          {error && !isRecording && (
            <span className="text-xs text-red-500">{error}</span>
          )}
        </>
      )}
    </div>
  );
};

export default AISpeechToText;
