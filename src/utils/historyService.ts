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
            console.error("Error fetching history");
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
        // Avoid duplicates: update the existing pair if the same
        // source text + language pair already exists
        const existing = await supabase
            .from("translation_history")
            .select("id")
            .eq("user_id", userId)
            .eq("source_text", sourceText)
            .eq("source_lang", sourceLang)
            .eq("target_lang", targetLang)
            .maybeSingle();

        if (!existing.error && existing.data) {
            const { data, error } = await supabase
                .from("translation_history")
                .update({ translated_text: translatedText })
                .eq("id", existing.data.id)
                .select()
                .single();

            if (error) {
                console.error("Error updating history");
                return null;
            }

            return data;
        }

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
            console.error("Error saving history");
            return null;
        }

        return data;
    },

    async update(
        id: string,
        userId: string,
        updates: {
            source_text?: string;
            translated_text?: string;
            source_lang?: string;
            target_lang?: string;
        }
    ): Promise<HistoryItem | null> {
        const { data, error } = await supabase
            .from("translation_history")
            .update(updates)
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();

        if (error) {
            console.error("Error updating history");
            return null;
        }

        return data;
    },

    async toggleFavorite(id: string, isFavorite: boolean, userId: string): Promise<boolean> {
        const { error } = await supabase
            .from("translation_history")
            .update({ is_favorite: isFavorite })
            .eq("id", id)
            .eq("user_id", userId);

        if (error) {
            console.error("Error toggling favorite");
            return false;
        }

        return true;
    },

    async delete(id: string, userId: string): Promise<boolean> {
        const { error } = await supabase
            .from("translation_history")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) {
            console.error("Error deleting history");
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
            console.error("Error clearing history");
            return false;
        }

        return true;
    },
};