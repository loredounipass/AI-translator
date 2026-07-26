import { supabase } from "./supabaseClient";

export const apiKeyService = {
  async get(userId: string, provider: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single();
    if (error || !data) return null;
    return data.api_key;
  },

  async upsert(userId: string, provider: string, apiKey: string): Promise<void> {
    const { error } = await supabase
      .from("user_api_keys")
      .upsert(
        { user_id: userId, provider, api_key: apiKey },
        { onConflict: "user_id, provider" }
      );
    if (error) throw new Error("Error al guardar la API key");
  },

  async remove(userId: string, provider: string): Promise<void> {
    const { error } = await supabase
      .from("user_api_keys")
      .delete()
      .eq("user_id", userId)
      .eq("provider", provider);
    if (error) throw new Error("Error al eliminar la API key");
  },
};
