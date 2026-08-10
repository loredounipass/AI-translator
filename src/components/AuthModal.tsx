import React from "react";
import { Select } from "antd";
import { COUNTRY_CODES } from "utils/phoneCodes";
import { useAuthModalLogic } from "../hooks/useAuthModalLogic";

const MailIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const BASE_INPUT_CLASSES = "w-full py-2.5 rounded-lg glass-input text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
    const {
        mode,
        email,
        setEmail,
        password,
        setPassword,
        firstName,
        setFirstName,
        lastName,
        setLastName,
        countryKey,
        setCountryKey,
        phoneNumber,
        setPhoneNumber,
        showPassword,
        setShowPassword,
        submitting,
        registeredEmail,
        handleClose,
        switchMode,
        handleEmailSubmit,
        countryCodeOptions,
    } = useAuthModalLogic({ onClose });

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 glass-overlay z-[65] transition-opacity duration-300"
                onClick={handleClose}
                aria-hidden="true"
            />

            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <div className="glass-modal rounded-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                    <div className="flex items-center justify-between p-5 pb-0">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Cerrar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {registeredEmail ? (
                            <div className="text-center py-6 space-y-4">
                                <div className="w-16 h-16 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 dark:text-blue-400">
                                        <rect x="3" y="4" width="18" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Verifica tu correo</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Enviamos un enlace de verificación a <strong className="text-slate-700 dark:text-slate-300">{registeredEmail}</strong>.
                                    Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
                                </p>
                                <button
                                    onClick={handleClose}
                                    className="px-6 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
                                >
                                    Entendido
                                </button>
                            </div>
                        ) : (
                        <>
                        <form onSubmit={handleEmailSubmit} className="space-y-3">
                            {mode === "register" && (
                                <>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                                <UserIcon />
                                            </div>
                                            <input
                                                type="text"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                placeholder="Nombre"
                                                className={`${BASE_INPUT_CLASSES} pl-10 pr-3`}
                                                autoComplete="given-name"
                                                required
                                                minLength={2}
                                            />
                                        </div>
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                placeholder="Apellido"
                                                className={`${BASE_INPUT_CLASSES} pl-3 pr-3`}
                                                autoComplete="family-name"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="phone-code-select w-[130px] flex-shrink-0">
                                            <Select
                                                value={countryKey}
                                                onChange={setCountryKey}
                                                options={countryCodeOptions}
                                                popupMatchSelectWidth={false}
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                                <PhoneIcon />
                                            </div>
                                            <input
                                                type="tel"
                                                value={phoneNumber}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/\D/g, "");
                                                    const selectedCode = COUNTRY_CODES.find((c) => c.uniqueKey === countryKey);
                                                    if (selectedCode) {
                                                        const prefix = selectedCode.code.replace("+", "");
                                                        if (raw.startsWith(prefix)) {
                                                            setPhoneNumber(raw.slice(prefix.length));
                                                            return;
                                                        }
                                                    }
                                                    setPhoneNumber(raw);
                                                }}
                                                placeholder="Teléfono"
                                                className={`${BASE_INPUT_CLASSES} pl-10 pr-3`}
                                                autoComplete="tel"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <MailIcon />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="correo@ejemplo.com"
                                    className={`${BASE_INPUT_CLASSES} pl-10 pr-3`}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <LockIcon />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Contraseña"
                                    className={`${BASE_INPUT_CLASSES} pl-10 pr-10`}
                                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting
                                    ? "Procesando..."
                                    : mode === "login"
                                        ? "Iniciar sesión"
                                        : "Crear cuenta"}
                            </button>
                        </form>

                        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                            {mode === "login" ? (
                                <>
                                    ¿No tienes cuenta?{" "}
                                    <button
                                        onClick={switchMode}
                                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                                    >
                                        Registrarse
                                    </button>
                                </>
                            ) : (
                                <>
                                    ¿Ya tienes cuenta?{" "}
                                    <button
                                        onClick={switchMode}
                                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                                    >
                                        Iniciar sesión
                                    </button>
                                </>
                            )}
                        </p>
                        </>
                    )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default AuthModal;