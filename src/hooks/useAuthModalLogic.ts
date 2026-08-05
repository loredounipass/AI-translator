import { useState } from "react";
import { useAuth } from "contexts/AuthContext";
import { AUTH_MESSAGES } from "utils/authConstants";
import { showSuccessToast, showErrorToast } from "components/AppNotifications";
import { COUNTRY_CODES, DEFAULT_COUNTRY_KEY } from "utils/phoneCodes";

type AuthMode = "login" | "register";

interface UseAuthModalLogicProps {
  onClose: () => void;
}



// MAIN HOOK FOR AUTH MODAL LOGIC
export const useAuthModalLogic = ({ onClose }: UseAuthModalLogicProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryKey, setCountryKey] = useState(DEFAULT_COUNTRY_KEY);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const { registerWithEmail, loginWithEmail } = useAuth();



  // RESET FORM STATE
  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setCountryKey(DEFAULT_COUNTRY_KEY);
    setPhoneNumber("");
    setSubmitting(false);
    setRegisteredEmail(null);
  };



  // HANDLE MODAL CLOSE
  const handleClose = () => {
    resetForm();
    onClose();
  };



  // SWITCH BETWEEN LOGIN AND REGISTER MODES
  const switchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setEmail("");
    setPassword("");
    setRegisteredEmail(null);
  };



  // HANDLE EMAIL AUTHENTICATION SUBMIT
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "register") {
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!strongPasswordRegex.test(password)) {
        showErrorToast("Contraseña débil", "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.");
        return;
      }
    }

    setSubmitting(true);

    let error: string | null = null;
    let needsVerification = false;

    if (mode === "login") {
      ({ error } = await loginWithEmail(email, password));
    } else {
      const selectedCode = COUNTRY_CODES.find((c) => c.uniqueKey === countryKey);
      const phone = phoneNumber && selectedCode ? `${selectedCode.code}${phoneNumber}` : "";
      const result = await registerWithEmail(email, password, { firstName, lastName, phone });
      error = result.error;
      needsVerification = result.needsVerification ?? false;
    }

    setSubmitting(false);

    if (error) {
      showErrorToast("Error", error);
      return;
    }

    if (mode === "register" && needsVerification) {
      setRegisteredEmail(email);
      showSuccessToast(AUTH_MESSAGES.REGISTER_SUCCESS);
      return;
    }

    // Login exitoso (o registro sin verificación requerida)
    sessionStorage.setItem("authAction", "login_success");
    handleClose();
    window.location.reload();
  };



  // PREPARE COUNTRY CODE OPTIONS
  const countryCodeOptions = COUNTRY_CODES.map((c) => ({
    value: c.uniqueKey,
    label: c.label,
  }));

  return {
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
  };
};
