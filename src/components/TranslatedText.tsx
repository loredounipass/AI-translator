import React from "react";
import CopyIcon from "assets/CopyIcon";
import { useTranslatedTextLogic } from "../hooks/useTranslatedTextLogic";

const TranslatedText = () => {
  const {
    isRTL,
    translatedText,
    isTranslating,
    copyHandler,
    copied,
    displayedText
  } = useTranslatedTextLogic();

  return (
    <div className={`relative bg-[#f3f4f6]/40 dark:bg-slate-800/40 text-[#0f1720] dark:text-slate-100 font-sans font-normal leading-normal ${isRTL ? 'text-right' : 'text-left'} text-lg break-words min-h-[100px] border-t md:border-t-0 md:border-l border-white/30 dark:border-slate-700/30 flex-1 flex flex-col transition-colors`}>
      {translatedText.length === 0 && !isTranslating ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-[#9ca3af] dark:text-slate-400 text-base font-normal p-4 px-6 text-center leading-relaxed">
          <div className="flex items-center justify-center">
            {displayedText}
            <span className="relative flex h-2 w-2 ml-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9ca3af] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9ca3af]"></span>
            </span>
          </div>
        </div>
      ) : translatedText.length === 0 && isTranslating ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-[#9ca3af] dark:text-slate-400 text-sm font-normal p-4 px-6 text-center leading-relaxed gap-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9ca3af] dark:bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9ca3af] dark:bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9ca3af] dark:bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span className="text-xs tracking-wide text-[#9ca3af] dark:text-slate-400">Translating...</span>
        </div>
      ) : (
        <div className="p-4 pb-14 overflow-auto max-h-[75vh] blue-scrollbar h-full whitespace-pre-wrap">
          {translatedText.join("\n")}
        </div>
      )}
      {translatedText.length !== 0 && (
        <div className="absolute bottom-2.5 right-2.5">
          <button onClick={copyHandler} aria-label="Copiar texto" className="bg-none border-none cursor-pointer p-1 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 hover:not-disabled:scale-110">
            <div className="text-[#2196F3] dark:text-blue-400">
              <CopyIcon />
            </div>
          </button>
        </div>
      )}
      {copied && <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 bg-[#333] text-white px-4 py-2 rounded-lg text-[13px] font-sans shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-20 animate-fadeIn whitespace-nowrap">Text copied</div>}
    </div>
  );
};

export default TranslatedText;