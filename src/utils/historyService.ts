import { supabase } from "./supabaseClient";

export interface HistoryItem {
    id: string;
    user_id: string;
    source_text: string;
    translated_text: string;
    source_lang: string;
    target_lang: string;
    is_favorite: boolean;
    created_at: string;
}

export const historyService = {
    async getAll(userId: string): Promise<HistoryItem[]> {
        const { data, error } = await supabase
            .from("translation_history")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching history:", error);
            return [];
        }

        return data || [];
    },

    async add(
        userId: string,
        sourceText: string,
        translatedText: string,
        sourceLang: string = "",
        targetLang: string = ""
    ): Promise<HistoryItem | null> {
        const { data, error } = await supabase
            .from("translation_history")
            .insert({
                user_id: userId,
                source_text: sourceText,
                translated_text: translatedText,
                source_lang: sourceLang,
                target_lang: targetLang,
            })
            .select()
            .single();

        if (error) {
            console.error("Error saving history:", error);
            return null;
        }

        return data;
    },

    async toggleFavorite(id: string, isFavorite: boolean): Promise<boolean> {
        const { error } = await supabase
            .from("translation_history")
            .update({ is_favorite: isFavorite })
            .eq("id", id);

        if (error) {
            console.error("Error toggling favorite:", error);
            return false;
        }

        return true;
    },

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase
            .from("translation_history")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting history:", error);
            return false;
        }

        return true;
    },

    async clearAll(userId: string): Promise<boolean> {
        const { error } = await supabase
            .from("translation_history")
            .delete()
            .eq("user_id", userId);

        if (error) {
            console.error("Error clearing history:", error);
            return false;
        }

        return true;
    },
};
