import React, { useEffect, useRef } from "react";
import CloseIcon from "../assets/CloseIcon";
import SpeechControls from "./SpeechControls";
import { showMicNotDetectedNotification } from "./AppNotifications";
import { useTranslationTextFieldLogic, MAX_URL_TEXT_LENGTH } from "../hooks/useTranslationTextFieldLogic";

const TranslationTextField = () => {
  const logic = useTranslationTextFieldLogic();
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
    isMicActive,
    isVoiceActive,
    startAudio
  } = logic;

  const micNotifiedRef = useRef(false);
  useEffect(() => {
    if (isMicrophoneAvailable === false && !micNotifiedRef.current) {
      micNotifiedRef.current = true;
      showMicNotDetectedNotification();
    }
    if (isMicrophoneAvailable) micNotifiedRef.current = false;
  }, [isMicrophoneAvailable]);

  // Determine which recording state to show
  const isRecording = aiStt.isAiStt ? aiStt.isRecording : listening;
  const isVoiceCurrentlyActive = aiStt.isAiStt ? isVoiceActive : isVoiceActive; // It uses the unified VAD state

  return (
    <div className="relative flex flex-col flex-1 min-h-0 font-sans font-normal leading-normal bg-white/40 dark:bg-slate-800/40 transition-colors">
      <div className="flex-1 relative min-h-0">
        <div
          className={`absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center text-lg text-[#9ca3af] dark:text-slate-500 font-sans pointer-events-none z-10 ${!text && (aiStt.isProcessing || isRecording || placeholder) ? 'flex' : 'hidden'}`}
        >
          {aiStt.isProcessing ? (
            <span className="animate-pulse">Transcribing...</span>
          ) : isRecording ? (
            <span className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full transition-colors duration-200 ${isVoiceCurrentlyActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400 animate-pulse'}`} />
              <span className={isVoiceCurrentlyActive ? "text-green-600 dark:text-green-500 font-medium" : "text-[#9ca3af] dark:text-slate-500"}>
                {isVoiceCurrentlyActive ? "Listening..." : "Waiting..."}
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
      
      {/* Speech Controls Component */}
      <SpeechControls
        aiStt={aiStt}
        keepMicOn={keepMicOn}
        setKeepMicOn={setKeepMicOn}
        handleSpeech={handleSpeech}
        isProcessing={isProcessing}
        listening={listening}
        regionActual={regionActual}
        handleChangeRegion={handleChangeRegion}
        regionesFiltradas={regionesFiltradas}
        regionesActuales={regionesActuales}
        browserSupportsSpeechRecognition={browserSupportsSpeechRecognition}
        startAudio={startAudio}
        isMicActive={isMicActive}
      />
    </div>
  );
};

export default TranslationTextField;