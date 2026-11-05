import { supabase } from "./supabaseClient";

// Version del disclaimer: si el texto cambia de forma material, subir a -v2
// y todos los usuarios seran re-prompteados una sola vez (auditables por key).
export const DISCLAIMER_KEY = "model-speeds-and-input-quality-v1";

export const disclaimerService = {
  // Devuelve true solo si existe registro de aceptacion para esta version.
  // Ante error de red/RLS devuelve false (fail-closed: el modal debe aparecer
  // hasta que la aceptacion quede realmente registrada).
  async hasAccepted(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("user_disclaimer_acceptances")
        .select("id")
        .eq("user_id", userId)
        .eq("disclaimer_key", DISCLAIMER_KEY)
        .maybeSingle();

      if (error || !data) return false;
      return true;
    } catch (e) {
      console.error("Error fetching disclaimer acceptance", e);
      return false;
    }
  },

  // Registra la aceptacion. Tolerante a duplicados (re-aceptar no es error).
  // Lanza si la escritura falla para que el modal permanezca abierto.
  async accept(userId: string): Promise<void> {
    const { error } = await supabase.from("user_disclaimer_acceptances").insert({
      user_id: userId,
      disclaimer_key: DISCLAIMER_KEY,
      accepted_at: new Date().toISOString(),
    });

    if (error) {
      // 23505 = unique violation: ya habia aceptado antes, cuenta como exito.
      if (error.code === "23505") return;
      throw error;
    }
  }
};
