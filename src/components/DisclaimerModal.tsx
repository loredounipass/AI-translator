import { BrainIcon, ZapIcon } from "./icons";

interface DisclaimerModalProps {
  isOpen: boolean;
  accepting: boolean;
  onAccept: () => void;
}

// Bloqueante por diseno: sin boton de cierre, sin click en el overlay y sin
// Escape. La unica salida es onAccept (logica en useDisclaimerModalLogic).
const DisclaimerModal = ({ isOpen, accepting, onAccept }: DisclaimerModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fixed inset-0 glass-overlay z-[75]" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="glass-modal rounded-2xl w-full max-w-md overflow-hidden animate-fadeIn relative z-[80]"
      >
        <div className="flex items-center gap-3 p-5 pb-0">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/25 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <h2 id="disclaimer-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Before You Continue
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Please review how this service works before using it. Your acceptance is recorded per account.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/25 shrink-0 mt-0.5">
                <BrainIcon size={14} />
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-800 dark:text-slate-100">Model behavior.</span>{" "}
                <span className="uppercase tracking-wide text-indigo-600 dark:text-indigo-300 font-semibold">Thinker</span> models
                reason before answering, so they are generally slower but more thorough;{" "}
                <span className="uppercase tracking-wide text-sky-600 dark:text-sky-300 font-semibold">Instant</span> models
                prioritize low latency for real-time conversation. Choose the model that fits the call.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/25 shrink-0 mt-0.5">
                <ZapIcon size={14} />
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-800 dark:text-slate-100">Output quality depends on input quality.</span>{" "}
                Speech-to-text mishearings, background noise, or incomplete sentences directly degrade the interpretation.
                Speak clearly, one voice at a time, and review the source text when possible.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/25 shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-800 dark:text-slate-100">Verify critical data.</span>{" "}
                AI-assisted output may contain errors. Independently confirm amounts, dates, numbers and identifiers
                before acting on them.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="w-full py-2.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {accepting ? "Recording..." : "I Understand and Accept"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
