import { supabase } from "./supabaseClient";

// Disclaimer(es) secuenciales que todo usuario debe aceptar, en orden.
// La tabla user_disclaimer_acceptances guarda una fila por usuario Y por key,
// asi cada disclaimer se audita individualmente. Si el texto de alguno cambia
// de forma material, subir su version (-v2) y ese disclaimer re-prompteara.
export const DISCLAIMER_KEYS: string[] = [
  "model-speeds-and-input-quality-v1",
  "app-nature-and-api-keys-v1",
];

export const disclaimerService = {
  // Devuelve true solo si existe registro de aceptacion para esa version.
  // Ante error de red/RLS devuelve false (fail-closed: el modal debe aparecer
  // hasta que la aceptacion quede realmente registrada).
  async hasAccepted(userId: string, disclaimerKey: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("user_disclaimer_acceptances")
        .select("id")
        .eq("user_id", userId)
        .eq("disclaimer_key", disclaimerKey)
        .maybeSingle();

      if (error || !data) return false;
      return true;
    } catch (e) {
      console.error("Error fetching disclaimer acceptance", e);
      return false;
    }
  },

  // Registra la aceptacion de un disclaimer concreto. Tolerante a duplicados.
  // Lanza si la escritura falla para que el modal permanezca abierto.
  async accept(userId: string, disclaimerKey: string): Promise<void> {
    const { error } = await supabase.from("user_disclaimer_acceptances").insert({
      user_id: userId,
      disclaimer_key: disclaimerKey,
      accepted_at: new Date().toISOString(),
    });

    if (error) {
      // 23505 = unique violation: ya habia aceptado antes, cuenta como exito.
      if (error.code === "23505") return;
      throw error;
    }
  }
};
