import React from "react";
import MicIcon from "../assets/MicIcon";
import PauseIcon from "../assets/PauseIcon";

interface AISpeechToTextProps {
  aiEnabled: boolean;
  onToggle: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const AISpeechToText = ({
  aiEnabled,
  onToggle,
  isRecording,
  isProcessing,
  error,
  onStartRecording,
  onStopRecording,
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
        <>
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isProcessing}
            aria-label={isRecording ? "Stop AI recording" : "Start AI recording"}
            className="bg-none border-none cursor-pointer p-1 transition-all duration-200 text-[#111] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-105"
          >
            {isRecording ? <PauseIcon size={30} /> : <MicIcon size={30} />}
          </button>
          {isProcessing && (
            <span className="text-xs text-blue-500 animate-pulse">Processing...</span>
          )}
          {error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
        </>
      )}
    </div>
  );
};

export default AISpeechToText;
