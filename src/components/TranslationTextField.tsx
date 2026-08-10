import React from "react";
import { Select } from "antd";
import CloseIcon from "../assets/CloseIcon";
import MicIcon from "assets/MicIcon";
import PauseIcon from "assets/PauseIcon";
import AISpeechToText from "./AISpeechToText";
import { useTranslationTextFieldLogic, MAX_URL_TEXT_LENGTH } from "../hooks/useTranslationTextFieldLogic";

const TranslationTextField = () => {
  const {
    text,
    aiStt,
    placeholder,
    textareaRef,
    handleChangeText,
    clearTextHandler,
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
    isMicrophoneAvailable,
    mediaStreamRef,
    ensureAudioStreamActive
  } = useTranslationTextFieldLogic();
  return (
    <div className="relative flex flex-col flex-1 min-h-0 font-sans font-normal leading-normal bg-white/40 dark:bg-slate-800/40 transition-colors">
      <div className="flex-1 relative min-h-0">
        <div
          className={`absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center text-lg text-[#9ca3af] dark:text-slate-500 font-sans pointer-events-none z-10 ${!text && (aiStt.isProcessing || aiStt.isRecording || placeholder) ? 'flex' : 'hidden'}`}
        >
          {aiStt.isProcessing ? (
            <span className="animate-pulse">Transcribing...</span>
          ) : aiStt.isRecording ? (
            <span className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full transition-colors duration-200 ${aiStt.isVoiceActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400 animate-pulse'}`} />
              <span className={aiStt.isVoiceActive ? "text-green-600 dark:text-green-500 font-medium" : "text-[#9ca3af] dark:text-slate-500"}>
                {aiStt.isVoiceActive ? "Listening..." : "Waiting..."}
              </span>
            </span>
          ) : (
            <>
              {placeholder}<span className="inline-block w-2 h-2 bg-[#9ca3af] dark:bg-slate-500 rounded-full ml-1 align-baseline relative -top-0.5 animate-blink" />
            </>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChangeText}
          placeholder=""
          aria-label="Texto para traducción"
          autoFocus
          spellCheck={false}
          maxLength={MAX_URL_TEXT_LENGTH}
          className="absolute inset-0 w-full h-full bg-transparent border-none outline-none shadow-none text-[#111111] dark:text-slate-100 p-4 pr-10 pb-16 text-lg resize-none transition-colors duration-200 focus:outline-none focus:shadow-none custom-scrollbar"
        ></textarea>
        {text && (
          <button
            className="absolute top-4 right-4 bg-none border-none cursor-pointer p-0 transition-opacity duration-200 text-[#333] dark:text-slate-400 hover:opacity-80 dark:hover:text-slate-200"
            onClick={clearTextHandler}
            aria-label="Limpiar texto"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <div className="flex shrink-0 pl-3 md:pl-4 pb-1">
        <span className="text-[10px] text-[#999] dark:text-slate-500 opacity-40 leading-none">
          {text.length.toLocaleString()} / {MAX_URL_TEXT_LENGTH.toLocaleString()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 flex-wrap pl-3 md:pl-4 pb-2.5">
        <AISpeechToText
          aiEnabled={aiStt.isAiStt}
          onToggle={aiStt.toggleAiStt}
          isRecording={aiStt.isRecording}
          isProcessing={aiStt.isProcessing}
          isVoiceActive={aiStt.isVoiceActive}
          captureSystemAudio={aiStt.captureSystemAudio}
          onToggleSystemAudio={aiStt.toggleSystemAudio}
          error={aiStt.error}
          onStartRecording={aiStt.startRecording}
          onStopRecording={aiStt.stopRecording}
          selectedModel={aiStt.selectedModel}
          onModelChange={aiStt.setSelectedModel}
        />
        {!aiStt.isAiStt && browserSupportsSpeechRecognition && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={keepMicOn}
                aria-label="Toggle keep microphone on"
                onClick={() => setKeepMicOn(prev => !prev)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKeepMicOn(prev => !prev); } }}
                className={`w-11 h-6 rounded-full border-none relative cursor-pointer p-0 transition-colors ${keepMicOn ? 'bg-[#4caf50] dark:bg-green-500' : 'bg-black dark:bg-slate-600'}`}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: keepMicOn ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }} />
              </button>
              <span className="text-[#333] dark:text-slate-300 text-xs whitespace-nowrap">{keepMicOn ? "Turn off" : "Turn on"}</span>
            </div>
            <button
              onMouseDown={() => { if (!mediaStreamRef.current && keepMicOn) ensureAudioStreamActive(); }}
              onTouchStart={() => { if (!mediaStreamRef.current && keepMicOn) ensureAudioStreamActive(); }}
              onClick={handleSpeech}
              disabled={isProcessing}
              aria-label={listening ? "Detener reconocimiento" : "Iniciar reconocimiento"}
              className="bg-none border-none cursor-pointer p-1 transition-all duration-200 text-[#111] dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-105"
            >
              {listening ? <PauseIcon /> : <MicIcon />}
            </button>
            {regionesActuales && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold">Jerga</span>
                <Select<string>
                  value={regionActual}
                  onChange={handleChangeRegion}
                  options={(regionesFiltradas ?? regionesActuales).map(r => ({ value: r.code, label: r.nombre }))}
                  popupMatchSelectWidth={false}
                  size="small"
                  className="region-select w-24 text-xs"
                />
              </div>
            )}
            {!isMicrophoneAvailable && (
              <span className="text-[#ff4444] text-xs animate-fadeIn whitespace-nowrap">
                Micrófono no detectado
              </span>
            )}
          </div>
        )}
        {!aiStt.isAiStt && !browserSupportsSpeechRecognition && (
          <p className="text-xs text-slate-400">Reconocimiento de voz no soportado</p>
        )}
      </div>
    </div>
  );
};

export default TranslationTextField;