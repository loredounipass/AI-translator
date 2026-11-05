import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { DISCLAIMER_KEYS, disclaimerService } from "../utils/disclaimerService";
import { showErrorToast } from "../components/AppNotifications";

// MAIN HOOK FOR DISCLAIMER MODAL LOGIC
// Atado a la sesion de Supabase: el flujo SOLO se muestra a usuarios autenticados.
// La fuente de verdad es la tabla user_disclaimer_acceptances (por user_id y key),
// no el almacenamiento del navegador: quien ya acepto no lo vuelve a ver en
// ningun dispositivo, y los invitados no son molestados ni auditables.
// Pasos: 0..N-1 disclaimers (requieren aceptacion) y N = welcome (informativo,
// solo se muestra al completar el flujo recien aceptado, nunca en re-entradas).
export const useDisclaimerModalLogic = () => {
  const { user, loading } = useAuth();
  // -1 = cerrado; >=0 = indice del disclaimer actual en DISCLAIMER_KEYS;
  // DISCLAIMER_KEYS.length = pantalla de bienvenida.
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [accepting, setAccepting] = useState(false);
  const WELCOME_STEP = DISCLAIMER_KEYS.length;

  // Al tener sesion, busca el primer disclaimer pendiente en DB y lo muestra.
  // Invitados (sin user) o auth cargando: modal cerrado. Un logout en medio
  // del flujo lo cierra tambien.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStepIndex(-1);
      return;
    }

    let cancelled = false;
    const resolveFirstPending = async () => {
      for (let i = 0; i < DISCLAIMER_KEYS.length; i++) {
        const accepted = await disclaimerService.hasAccepted(user.id, DISCLAIMER_KEYS[i]);
        if (cancelled) return;
        if (!accepted) {
          setStepIndex(i);
          return;
        }
      }
      if (!cancelled) setStepIndex(-1); // todo aceptado: no se vuelve a mostrar
    };

    resolveFirstPending();
    return () => { cancelled = true; };
  }, [user, loading]);

  // ACEPTA el disclaimer actual (fila en DB) y avanza al siguiente pendiente.
  // Si la escritura falla, NO avanza: el modal queda en el mismo paso.
  // Al aceptar el ultimo, muestra la bienvenida (paso virtual, no se registra).
  const handleAccept = useCallback(async () => {
    if (!user || stepIndex < 0 || stepIndex >= WELCOME_STEP) return;
    setAccepting(true);
    try {
      await disclaimerService.accept(user.id, DISCLAIMER_KEYS[stepIndex]);

      // Pasos posteriores: solo re-muestra los que DB aun no tenga aceptados
      // (cubre aceptar en otro dispositivo a mitad del flujo).
      for (let i = stepIndex + 1; i < DISCLAIMER_KEYS.length; i++) {
        const accepted = await disclaimerService.hasAccepted(user.id, DISCLAIMER_KEYS[i]);
        if (!accepted) {
          setStepIndex(i);
          return;
        }
      }
      setStepIndex(WELCOME_STEP);
    } catch (err) {
      console.error("Error recording disclaimer acceptance", err);
      // Se muestra el mensaje real (p. ej. RLS/42P01) para diagnosticar sin
      // abrir DevTools; el detalle tecnico queda igual en consola.
      const detail = err instanceof Error && err.message ? err.message : "";
      showErrorToast(
        "Error",
        detail
          ? `Could not record your acceptance: ${detail}`
          : "Could not record your acceptance. Please try again."
      );
    } finally {
      setAccepting(false);
    }
  }, [user, stepIndex, WELCOME_STEP]);

  // CIERRA el flujo desde la pantalla de bienvenida (no registra nada).
  const handleFinish = useCallback(() => setStepIndex(-1), []);

  return {
    isOpen: stepIndex >= 0,
    stepIndex,
    totalSteps: DISCLAIMER_KEYS.length,
    isLastStep: stepIndex === DISCLAIMER_KEYS.length - 1,
    isWelcome: stepIndex === WELCOME_STEP,
    accepting,
    handleAccept,
    handleFinish,
  };
};
