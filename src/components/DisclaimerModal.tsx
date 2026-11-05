import { BrainIcon, ZapIcon } from "./icons";

interface DisclaimerModalProps {
  isOpen: boolean;
  stepIndex: number;
  totalSteps: number;
  isLastStep: boolean;
  isWelcome: boolean;
  accepting: boolean;
  onAccept: () => void;
  onFinish: () => void;
}

const Bullet = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/25 shrink-0 mt-0.5">
      {icon}
    </span>
    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{children}</p>
  </div>
);

const Strong = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-slate-800 dark:text-slate-100">{children}</span>
);

// Bloqueante por diseno: sin boton de cierre, sin click en el overlay y sin
// Escape. Un "Next" registra la aceptacion del paso actual y avanza; al aceptar
// el ultimo disclaimer aparece la bienvenida y "Get Started" cierra el flujo.
const DisclaimerModal = ({ isOpen, stepIndex, totalSteps, isLastStep, isWelcome, accepting, onAccept, onFinish }: DisclaimerModalProps) => {
  if (!isOpen) return null;

  // Pantalla final de bienvenida: check verde dibujado + carita profesional,
  // con entradas escalonadas (pop-in -> draw -> rise-in). Cierre con onFinish.
  if (isWelcome) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="fixed inset-0 glass-overlay z-[75]" aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-welcome-title"
          className="glass-modal rounded-2xl w-full max-w-md overflow-hidden animate-fadeIn relative z-[80]"
        >
          <div className="p-8 flex flex-col items-center text-center">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 animate-pop-in">
              <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 dark:text-emerald-400 animate-draw-check">
                <path d="M20 6L9 17l-5-5" pathLength={24} strokeDasharray={24} />
              </svg>
            </span>

            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-400/10 text-amber-500 ring-1 ring-amber-400/25 mt-4 animate-rise-in [animation-delay:0.45s]">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </span>

            <h2 id="disclaimer-welcome-title" className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100 animate-rise-in [animation-delay:0.55s]">
              Welcome Aboard!
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed animate-rise-in [animation-delay:0.7s]">
              Thank you for using our software. Your professional interpreter workspace is ready — select your languages and start.
            </p>

            <button
              type="button"
              onClick={onFinish}
              className="mt-6 w-full py-2.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors flex items-center justify-center gap-2 animate-rise-in [animation-delay:0.85s]"
            >
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <span className="ml-auto text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {stepIndex === 0 ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Please review how this service works before using it. Your acceptance is recorded per account.
              </p>

              <div className="space-y-3">
                <Bullet icon={<BrainIcon size={14} />}>
                  <Strong>Model behavior.</Strong>{" "}
                  <span className="uppercase tracking-wide text-indigo-600 dark:text-indigo-300 font-semibold">Thinker</span> models
                  reason before answering, so they are generally slower but more thorough;{" "}
                  <span className="uppercase tracking-wide text-sky-600 dark:text-sky-300 font-semibold">Instant</span> models
                  prioritize low latency for real-time conversation. Choose the model that fits the call.
                </Bullet>

                <Bullet icon={<ZapIcon size={14} />}>
                  <Strong>Output quality depends on input quality.</Strong>{" "}
                  Speech-to-text mishearings, background noise, or incomplete sentences directly degrade the interpretation.
                  Speak clearly, one voice at a time, and review the source text when possible.
                </Bullet>

                <Bullet
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  }
                >
                  <Strong>Verify critical data.</Strong>{" "}
                  AI-assisted output may contain errors. Independently confirm amounts, dates, numbers and identifiers
                  before acting on them.
                </Bullet>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                One more item to acknowledge about this application.
              </p>

              <div className="space-y-3">
                <Bullet
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 5h16v11H7l-3 3V5z" />
                    </svg>
                  }
                >
                  <Strong>What this app is.</Strong>{" "}
                  This is a translation and interpretation aid for professional over-the-phone interpreters.
                  Transcription and interpretation are performed by third-party artificial-intelligence models,
                  not by human translators.
                </Bullet>

                <Bullet
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                  }
                >
                  <Strong>Bring your own API key.</Strong>{" "}
                  The app connects to AI providers (NVIDIA, Google, OpenAI, Anthropic) using <Strong>your own</Strong> API keys.
                  Usage is billed to your account with each provider under its own terms; this app does not include model access.
                </Bullet>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="w-full py-2.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {accepting
              ? "Recording..."
              : isLastStep
                ? "I Understand and Accept"
                : (
                  <>
                    Next
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
