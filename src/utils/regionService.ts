import { supabase } from "./supabaseClient";
import { notifyAuthExpired } from "./authEvents";

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
            notifyAuthExpired(error);
            console.error("Error fetching regions");
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

        if (error) {
            notifyAuthExpired(error);
            return null;
        }
        return data ? data.region_code : null;
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
            notifyAuthExpired(error);
            console.error("Error saving region");
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
            notifyAuthExpired(error);
            console.error("Error deleting region");
            return false;
        }
        return true;
    },
};
