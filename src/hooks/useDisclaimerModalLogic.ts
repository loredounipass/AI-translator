import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { disclaimerService, DISCLAIMER_KEY } from "../utils/disclaimerService";
import { showErrorToast } from "../components/AppNotifications";

// Flag de sesion: usuarios logueados se verifican contra la base (aceptacion
// permanente e individual). Los invitados aceptan por sesion de navegador; al
// loguearse, la falta de fila en DB los re-promptea y queda auditada.
const SESSION_FLAG = "disclaimerAcceptedSession";

// MAIN HOOK FOR DISCLAIMER MODAL LOGIC (blocking: no close until accepted)
export const useDisclaimerModalLogic = () => {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    const check = async () => {
      try {
        if (sessionStorage.getItem(SESSION_FLAG) === DISCLAIMER_KEY) {
          if (!cancelled) setIsOpen(false);
          return;
        }
      } catch { /* storage bloqueado: continuar con la verificacion */ }

      if (user) {
        const accepted = await disclaimerService.hasAccepted(user.id);
        if (!cancelled) setIsOpen(!accepted);
      } else if (!cancelled) {
        setIsOpen(true);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [user, loading]);

  // REGISTRAR ACEPTACION: en DB si hay usuario; en sessionStorage siempre para
  // no re-promptear dentro de la misma sesion. Si la escritura falla, el modal
  // sigue abierto (no se cierra sin aceptacion efectiva).
  const handleAccept = useCallback(async () => {
    setAccepting(true);
    try {
      if (user) await disclaimerService.accept(user.id);
      try { sessionStorage.setItem(SESSION_FLAG, DISCLAIMER_KEY); } catch { }
      setIsOpen(false);
    } catch (err) {
      console.error("Error recording disclaimer acceptance", err);
      showErrorToast("Error", "Could not record your acceptance. Please try again.");
    } finally {
      setAccepting(false);
    }
  }, [user]);

  return {
    isOpen,
    accepting,
    handleAccept,
  };
};
