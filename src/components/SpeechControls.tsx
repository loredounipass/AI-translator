import React from "react";
import GlassTooltip from "./GlassTooltip";
import MicIcon from "../assets/MicIcon";
import PauseIcon from "../assets/PauseIcon";
import AISpeechToText from "./AISpeechToText";

export const ToggleSwitch = ({ checked, onChange, tooltip, disabled }: { checked: boolean; onChange: () => void; tooltip: string; disabled?: boolean }) => (
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

interface SpeechControlsProps {
  // STT State
  aiStt: any;
  keepMicOn: boolean;
  setKeepMicOn: React.Dispatch<React.SetStateAction<boolean>>;
  handleSpeech: () => void;
  isProcessing: boolean;
  listening: boolean;
  
  // Region State
  regionActual: string;
  handleChangeRegion: (region: string) => void;
  regionesFiltradas: any[] | null;
  regionesActuales: any[] | null;
  
  // Browser capabilities
  browserSupportsSpeechRecognition: boolean;
  
  // Unified Audio State
  startAudio: (captureSystemAudio?: boolean) => Promise<any>;
  isMicActive: boolean;
  captureSystemAudio: boolean;
  onToggleSystemAudio: () => void;
}

const SpeechControls = ({
  aiStt,
  keepMicOn,
  setKeepMicOn,
  handleSpeech,
  isProcessing,
  listening,
  regionActual,
  handleChangeRegion,
  regionesFiltradas,
  regionesActuales,
  browserSupportsSpeechRecognition,
  startAudio,
  isMicActive,
  captureSystemAudio,
  onToggleSystemAudio
}: SpeechControlsProps) => {

  const isRecording = aiStt.isAiStt ? aiStt.isRecording : listening;

  return (
    <div className="flex shrink-0 items-center gap-2 flex-wrap pl-3 md:pl-4 pb-2.5">
      {/* AI Controls */}
      <AISpeechToText
        aiEnabled={aiStt.isAiStt}
        onToggle={aiStt.toggleAiStt}
        isRecording={aiStt.isRecording}
        isProcessing={aiStt.isProcessing}
        captureSystemAudio={captureSystemAudio}
        onToggleSystemAudio={onToggleSystemAudio}
        error={aiStt.error}
        selectedModel={aiStt.selectedModel}
        onModelChange={aiStt.setSelectedModel}
      />

      {/* Native STT Options (Hidden if AI STT is ON) */}
      {!aiStt.isAiStt && browserSupportsSpeechRecognition && (
        <div className="flex items-center gap-2">
          <ToggleSwitch 
            checked={keepMicOn} 
            onChange={() => setKeepMicOn(prev => !prev)} 
            tooltip="Mantener Micrófono Activo" 
          />

          {regionesActuales && (
            <div className="flex items-center ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <GlassTooltip label="Jerga">
                <select
                  value={regionActual}
                  onChange={(e) => handleChangeRegion(e.target.value)}
                  className="glass-select text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-400 shadow-sm font-sans w-24 truncate transition-colors cursor-pointer"
                >
                  {(regionesFiltradas ?? regionesActuales).map(r => (
                    <option key={r.code} value={r.code}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </GlassTooltip>
            </div>
          )}
        </div>
      )}

      {/* Unified Microphone Button */}
      {(aiStt.isAiStt || browserSupportsSpeechRecognition) && (
        <button
          onClick={() => handleSpeech()}
          disabled={isProcessing || aiStt.isProcessing}
          aria-label={isRecording ? "Detener reconocimiento" : "Iniciar reconocimiento"}
          className="bg-none border-none cursor-pointer p-1 transition-all duration-200 text-[#111] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-105 ml-2"
        >
          {isRecording ? <PauseIcon size={30} /> : <MicIcon size={30} />}
        </button>
      )}

      {!aiStt.isAiStt && !browserSupportsSpeechRecognition && (
        <p className="text-xs text-slate-400">Reconocimiento de voz no soportado</p>
      )}
    </div>
  );
};

export default SpeechControls;
