import { supabase } from "./supabaseClient";

export interface UserRegion {
    id: string;
    user_id: string;
    base_lang: string;
    region_code: string;
    created_at: string;
    updated_at: string;
}

export const regionService = {
    async getAll(userId: string): Promise<UserRegion[]> {
        const { data, error } = await supabase
            .from("user_regions")
            .select("*")
            .eq("user_id", userId);

        if (error) {
            console.error("Error fetching regions:", error);
            return [];
        }
        return data || [];
    },

    async getRegion(userId: string, baseLang: string): Promise<string | null> {
        const { data, error } = await supabase
            .from("user_regions")
            .select("region_code")
            .eq("user_id", userId)
            .eq("base_lang", baseLang)
            .maybeSingle();

        if (error || !data) return null;
        return data.region_code;
    },

    async upsertRegion(userId: string, baseLang: string, regionCode: string): Promise<boolean> {
        const { error } = await supabase
            .from("user_regions")
            .upsert(
                {
                    user_id: userId,
                    base_lang: baseLang,
                    region_code: regionCode,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id, base_lang", ignoreDuplicates: false }
            );

        if (error) {
            console.error("Error saving region:", error);
            return false;
        }
        return true;
    },

    async deleteRegion(userId: string, baseLang: string): Promise<boolean> {
        const { error } = await supabase
            .from("user_regions")
            .delete()
            .eq("user_id", userId)
            .eq("base_lang", baseLang);

        if (error) {
            console.error("Error deleting region:", error);
            return false;
        }
        return true;
    },
};
