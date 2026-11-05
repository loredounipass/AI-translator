import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { DISCLAIMER_KEYS, disclaimerService } from "../utils/disclaimerService";
import { showErrorToast } from "../components/AppNotifications";

// Flag de sesion: almacena (JSON) las keys ya aceptadas en esta sesion de
// navegador. Usuarios logueados ademas se verifican/registran en DB (aceptacion
// permanente e individual). Los invitados solo usan sessionStorage; al loguearse
// la falta de fila en DB los re-promptea y queda auditada.
const SESSION_FLAG = "disclaimerAcceptedKeys";

const readSessionKeys = (): string[] => {
  try {
    const raw = sessionStorage.getItem(SESSION_FLAG);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const writeSessionKey = (key: string) => {
  try {
    const keys = readSessionKeys();
    if (!keys.includes(key)) keys.push(key);
    sessionStorage.setItem(SESSION_FLAG, JSON.stringify(keys));
  } catch { /* storage bloqueado */ }
};

// MAIN HOOK FOR DISCLAIMER MODAL LOGIC (multi-step, blocking until all accepted)
// Pasos: 0..N-1 disclaimers (requieren aceptacion) y N = welcome (informativo,
// no se registra en DB; solo se muestra al completar el flujo en esta sesion).
export const useDisclaimerModalLogic = () => {
  const { user, loading } = useAuth();
  // -1 = cerrado; >=0 = indice del disclaimer actual en DISCLAIMER_KEYS;
  // DISCLAIMER_KEYS.length = pantalla de bienvenida.
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [accepting, setAccepting] = useState(false);

  // Determina el primer disclaimer no aceptado (sesion + DB) y lo muestra.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    const resolveFirstPending = async () => {
      const sessionKeys = readSessionKeys();
      for (let i = 0; i < DISCLAIMER_KEYS.length; i++) {
        const key = DISCLAIMER_KEYS[i];
        if (sessionKeys.includes(key)) continue;
        if (user) {
          const accepted = await disclaimerService.hasAccepted(user.id, key);
          if (accepted) {
            writeSessionKey(key); // cache para no re-consultar en esta sesion
            continue;
          }
        }
        if (!cancelled) setStepIndex(i);
        return;
      }
      if (!cancelled) setStepIndex(-1); // todo aceptado
    };

    resolveFirstPending();
    return () => { cancelled = true; };
  }, [user, loading]);

  // ACEPTA el disclaimer actual y avanza al siguiente pendiente (o cierra).
  // Si la escritura en DB falla, NO avanza: el modal queda en el mismo paso.
  const handleAccept = useCallback(async () => {
    if (stepIndex < 0 || stepIndex >= DISCLAIMER_KEYS.length) return;
    const key = DISCLAIMER_KEYS[stepIndex];
    setAccepting(true);
    try {
      if (user) await disclaimerService.accept(user.id, key);
      writeSessionKey(key);

      // Siguiente key no aceptada en la sesion (DB ya no hace falta re-cargar:
      // las previas quedaron resueltas arriba y la actual esta aceptada).
      const sessionKeys = readSessionKeys();
      const next = DISCLAIMER_KEYS.findIndex((k) => !sessionKeys.includes(k));
      // -1 => no quedan pendientes: mostrar la bienvenida (paso virtual N).
      setStepIndex(next === -1 ? DISCLAIMER_KEYS.length : next);
    } catch (err) {
      console.error("Error recording disclaimer acceptance", err);
      showErrorToast("Error", "Could not record your acceptance. Please try again.");
    } finally {
      setAccepting(false);
    }
  }, [user, stepIndex]);

  // CIERRA el flujo desde la pantalla de bienvenida (no registra nada).
  const handleFinish = useCallback(() => setStepIndex(-1), []);

  return {
    isOpen: stepIndex >= 0,
    stepIndex,
    totalSteps: DISCLAIMER_KEYS.length,
    isLastStep: stepIndex === DISCLAIMER_KEYS.length - 1,
    isWelcome: stepIndex === DISCLAIMER_KEYS.length,
    accepting,
    handleAccept,
    handleFinish,
  };
};
