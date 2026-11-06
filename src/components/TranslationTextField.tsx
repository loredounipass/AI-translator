import React, { useEffect, useRef, useState } from "react";
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
    startAudio,
    captureSystemAudio,
    setCaptureSystemAudio
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

  // MINIMUM VISIBLE TIME FOR "Transcribing": BACK-TO-BACK FETCHES MUST NOT FLICKER
  const [showTranscribing, setShowTranscribing] = useState(false);
  const transcribingHideTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (aiStt.isProcessing) {
      if (transcribingHideTimerRef.current) {
        window.clearTimeout(transcribingHideTimerRef.current);
        transcribingHideTimerRef.current = null;
      }
      setShowTranscribing(true);
    } else {
      transcribingHideTimerRef.current = window.setTimeout(() => {
        transcribingHideTimerRef.current = null;
        setShowTranscribing(false);
      }, 350);
    }
    return () => {
      if (transcribingHideTimerRef.current) window.clearTimeout(transcribingHideTimerRef.current);
    };
  }, [aiStt.isProcessing]);

  const statusVisible = !text && (showTranscribing || isRecording);
  // PLACEHOLDER ONLY ON A TRULY EMPTY FIELD: ANY TEXT (TYPED OR DICTATED) HIDES IT
  const placeholderVisible = !text && !statusVisible && !!placeholder;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 font-sans font-normal leading-normal bg-white/40 dark:bg-slate-800/40 transition-colors">
      <div className="flex-1 relative min-h-0">
        {/* BASE PLACEHOLDER: ALWAYS MOUNTED, FADES VIA OPACITY (NEVER UNMOUNTS) */}
        <div
          aria-hidden="true"
          className={`absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center text-lg text-[#9ca3af] dark:text-slate-500 font-sans pointer-events-none transition-opacity duration-200 ${placeholderVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {placeholder}<span className="inline-block w-2 h-2 bg-[#9ca3af] dark:bg-slate-500 rounded-full ml-1 align-baseline relative -top-0.5 animate-blink" />
        </div>

        {/* DICTATION STATUS OVERLAY: ALWAYS MOUNTED, FADES IN/OUT */}
        <div
          aria-hidden="true"
          className={`absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center text-lg font-sans pointer-events-none transition-opacity duration-200 ${statusVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {showTranscribing ? (
            <span className="animate-pulse text-[#9ca3af] dark:text-slate-500">Transcribing...</span>
          ) : isRecording ? (
            <span className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full transition-colors duration-200 ${isVoiceCurrentlyActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400 animate-pulse'}`} />
              <span className={isVoiceCurrentlyActive ? "text-green-600 dark:text-green-500 font-medium" : "text-[#9ca3af] dark:text-slate-500"}>
                {isVoiceCurrentlyActive ? "Listening..." : "Waiting..."}
              </span>
            </span>
          ) : null}
        </div>
        
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChangeText}
          placeholder=""
          aria-label="Texto para traducción"
          spellCheck={false}
          maxLength={MAX_URL_TEXT_LENGTH}
          className="absolute inset-0 w-full h-full bg-transparent border-none outline-none shadow-none text-[#111111] dark:text-slate-100 p-4 pl-5 md:pl-6 pr-10 pb-16 text-lg resize-none transition-colors duration-200 focus:outline-none focus:shadow-none custom-scrollbar"
        ></textarea>
        
        {/* CLEAR BUTTON: ALWAYS MOUNTED, TOGGLES OPACITY ONLY (NO MOUNT POP) */}
        <button
          className={`absolute top-4 right-4 bg-none border-none p-0 transition-opacity duration-200 text-[#333] dark:text-slate-400 hover:opacity-80 dark:hover:text-slate-200 ${text ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'}`}
          onClick={clearTextHandler}
          tabIndex={text ? 0 : -1}
          aria-label="Limpiar texto"
        >
          <CloseIcon />
        </button>
      </div>
      
      <div className="flex shrink-0 pl-3 md:pl-4 pb-1">
        <span className={`text-[10px] leading-none transition-colors duration-200 ${text.length >= MAX_URL_TEXT_LENGTH ? 'text-red-500 opacity-100' : 'text-[#999] dark:text-slate-500 opacity-40'}`}>
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
        captureSystemAudio={captureSystemAudio}
        onToggleSystemAudio={() => setCaptureSystemAudio(prev => !prev)}
      />
    </div>
  );
};

export default TranslationTextField;