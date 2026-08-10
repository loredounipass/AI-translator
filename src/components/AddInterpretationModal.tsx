import React from "react";
import { Select } from "antd";
import { useAddInterpretationModalLogic } from "../hooks/useAddInterpretationModalLogic";
import { SwitchIcon } from "../assets/SwitchIcon";

interface AddInterpretationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInterpretationAdded: () => void;
}

const AddInterpretationModal: React.FC<AddInterpretationModalProps> = ({
  isOpen,
  onClose,
  onInterpretationAdded,
}) => {
  const {
    sourceText,
    setSourceText,
    targetText,
    setTargetText,
    sourceLang,
    targetLang,
    isSubmitting,
    languageOptions,
    handleSourceLangChange,
    handleTargetLangChange,
    handleSwitchLanguages,
    handleSubmit,
    user,
  } = useAddInterpretationModalLogic({
    isOpen,
    onClose,
    onInterpretationAdded,
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/50 dark:border-slate-700/50 pointer-events-auto animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <div>
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-slate-800 dark:text-slate-100"
                >
                  Agregar Interpretación
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Añade tu propia traducción al historial
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Cerrar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {!user ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-400"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  Inicia sesión para agregar interpretaciones
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Debes estar autenticado para guardar en tu historial
                </p>
              </div>
            ) : (
              <>
                {/* Language Selector Bar */}
                <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Idiomas de la interpretación
                  </label>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Select<string>
                      value={sourceLang}
                      onChange={handleSourceLangChange}
                      options={languageOptions}
                      aria-label="Idioma origen"
                      popupMatchSelectWidth={false}
                      className="lang-select flex-1"
                      dropdownStyle={{ minWidth: 180 }}
                    />

                    <button
                      onClick={handleSwitchLanguages}
                      aria-label="Intercambiar idiomas"
                      className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer p-2 rounded-lg transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-600 hover:rotate-180 hover:scale-110 active:rotate-180 active:scale-95 text-slate-500 dark:text-slate-300 shadow-sm flex-shrink-0"
                    >
                      <SwitchIcon />
                    </button>

                    <Select<string>
                      value={targetLang}
                      onChange={handleTargetLangChange}
                      options={languageOptions}
                      aria-label="Idioma destino"
                      popupMatchSelectWidth={false}
                      className="lang-select flex-1"
                      dropdownStyle={{ minWidth: 180 }}
                    />
                  </div>
                </div>

                {/* Source Text Input */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-500"
                    >
                      <path d="M4 7V4h16v3"></path>
                      <path d="M9 20h6"></path>
                      <path d="M12 4v16"></path>
                    </svg>
                    Texto en idioma origen
                  </label>
                  <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Escribe el texto original aquí..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all resize-none"
                  />
                  <p className="text-xs text-slate-400">
                    Este es el texto original que deseas traducir
                  </p>
                </div>

                {/* Target Text Input */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-green-500"
                    >
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                    Tu interpretación (traducción)
                  </label>
                  <textarea
                    value={targetText}
                    onChange={(e) => setTargetText(e.target.value)}
                    placeholder="Escribe tu traducción aquí..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 transition-all resize-none"
                  />
                  <p className="text-xs text-slate-400">
                    Esta es tu traducción manual que se usará para mejorar futuras traducciones
                  </p>
                </div>

                {/* Info box */}
                <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center flex-shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-blue-600 dark:text-blue-400"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        ¿Cómo funciona?
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Al agregar tu interpretación, el modelo la usará como referencia para mejorar futuras traducciones entre estos idiomas. Esto es especialmente útil para términos técnicos, expresiones coloquiales o contextos específicos.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-5 shrink-0">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  !sourceText.trim() ||
                  !targetText.trim() ||
                  !user
                }
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Guardar Interpretación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddInterpretationModal;
