import { supabase } from "./supabaseClient";

export interface UserLanguagePrefs {
  source_lang: string;
  target_lang: string;
}

export const languagePrefsService = {
  async getPrefs(userId: string): Promise<UserLanguagePrefs | null> {
    try {
      const { data, error } = await supabase
        .from("user_language_preferences")
        .select("source_lang, target_lang")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (error || !data) return null;
      return data as UserLanguagePrefs;
    } catch (e) {
      console.error("Error fetching language preferences", e);
      return null;
    }
  },

  async savePrefs(userId: string, sl: string, tl: string): Promise<void> {
    try {
      await supabase.from("user_language_preferences").upsert({
        user_id: userId,
        source_lang: sl,
        target_lang: tl,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
    } catch (e) {
      console.error("Error saving language preferences", e);
    }
  }
};
