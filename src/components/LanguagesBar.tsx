import React from "react";
import { Select } from "antd";
import { SwitchIcon } from "../assets/SwitchIcon";
import { useLanguagesBarLogic } from "../hooks/useLanguagesBarLogic";

const LanguagesBar = () => {
  const {
    sourceLang,
    targetLang,
    languageOptions,
    switchLangsHandler,
    handleChangeSourceLang,
    handleChangeTargetLang
  } = useLanguagesBarLogic();

  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-between p-2 md:p-3 px-5 md:px-6 gap-2 md:gap-4 border-b border-slate-200 dark:border-slate-700 w-full overflow-hidden transition-colors">
      <Select<string>
        value={sourceLang}
        onChange={handleChangeSourceLang}
        options={languageOptions as unknown as { value: string; label: string }[]}
        aria-label="Seleccionar idioma origen"
        popupMatchSelectWidth={false}
        className="lang-select w-0 flex-1 min-w-0"
      />
      
      <button
        onClick={switchLangsHandler}
        aria-label="Intercambiar idiomas"
        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer p-1.5 md:p-2 rounded-full transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-600 hover:rotate-180 hover:scale-110 active:rotate-180 active:scale-95 text-slate-500 dark:text-slate-300 shadow-sm flex-shrink-0"
      >
        <SwitchIcon />
      </button>
      
      <Select<string>
        value={targetLang}
        onChange={handleChangeTargetLang}
        options={languageOptions as unknown as { value: string; label: string }[]}
        aria-label="Seleccionar idioma destino"
        popupMatchSelectWidth={false}
        className="lang-select w-0 flex-1 min-w-0"
      />
    </div>
  );
};

export default React.memo(LanguagesBar);
