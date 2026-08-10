import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { historyService } from "utils/historyService";
import { languagePrefsService } from "utils/languagePrefsService";
import {
    DEFAULT_SOURCE_LANGUAGE,
    DEFAULT_TARGET_LANGUAGE,
    DEFAULT_MODEL,
    AI_MODELS,
} from "utils/constants";
import { AVAILABLE_LANGUAGES } from "utils/constants";
import { translationMemory } from "api/translation/translationMemory";
import { translationCache, getCacheKey } from "api/translation/cache";
import { showErrorToast } from "components/AppNotifications";

interface UseAddInterpretationModalLogicProps {
    isOpen: boolean;
    onClose: () => void;
    onInterpretationAdded: () => void;
}

export const useAddInterpretationModalLogic = ({
    isOpen,
    onClose,
    onInterpretationAdded,
}: UseAddInterpretationModalLogicProps) => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    const [sourceText, setSourceText] = useState("");
    const [targetText, setTargetText] = useState("");
    const [sourceLang, setSourceLang] = useState(DEFAULT_SOURCE_LANGUAGE);
    const [targetLang, setTargetLang] = useState(DEFAULT_TARGET_LANGUAGE);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // LOAD LANGUAGE PREFERENCES FROM URL PARAMS OR USER PREFS WHEN MODAL OPENS
    useEffect(() => {
        if (isOpen && user) {
            const urlSourceLang = searchParams.get("sl");
            const urlTargetLang = searchParams.get("tl");

            if (
                urlSourceLang &&
                AVAILABLE_LANGUAGES.some((l) => l.code === urlSourceLang)
            ) {
                setSourceLang(urlSourceLang);
            } else {
                languagePrefsService.getPrefs(user.id).then((prefs) => {
                    if (prefs?.source_lang) {
                        setSourceLang(prefs.source_lang);
                    }
                });
            }

            if (
                urlTargetLang &&
                AVAILABLE_LANGUAGES.some((l) => l.code === urlTargetLang)
            ) {
                setTargetLang(urlTargetLang);
            } else {
                languagePrefsService.getPrefs(user.id).then((prefs) => {
                    if (prefs?.target_lang) {
                        setTargetLang(prefs.target_lang);
                    }
                });
            }
        }
    }, [isOpen, user, searchParams]);

    // RESET FORM WHEN MODAL CLOSES
    useEffect(() => {
        if (!isOpen) {
            setSourceText("");
            setTargetText("");
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const languageOptions = AVAILABLE_LANGUAGES.map((lang) => ({
        value: lang.code,
        label: lang.name,
    }));

    // SWAP SOURCE AND TARGET LANGUAGES AND TEXTS
    const handleSwitchLanguages = useCallback(() => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        if (sourceText && targetText) {
            setSourceText(targetText);
            setTargetText(sourceText);
        }
    }, [sourceLang, targetLang, sourceText, targetText]);

    // HANDLE SOURCE LANGUAGE CHANGE WITH AUTO-SWAP IF SAME AS TARGET
    const handleSourceLangChange = useCallback(
        (value: string) => {
            if (value === targetLang) {
                handleSwitchLanguages();
            } else {
                setSourceLang(value);
            }
        },
        [targetLang, handleSwitchLanguages]
    );

    // HANDLE TARGET LANGUAGE CHANGE WITH AUTO-SWAP IF SAME AS SOURCE
    const handleTargetLangChange = useCallback(
        (value: string) => {
            if (value === sourceLang) {
                handleSwitchLanguages();
            } else {
                setTargetLang(value);
            }
        },
        [sourceLang, handleSwitchLanguages]
    );

    // SUBMIT INTERPRETATION TO HISTORY
    const handleSubmit = useCallback(async () => {
        if (!user) {
            console.error("User not authenticated");
            return;
        }

        if (!sourceText.trim() || !targetText.trim()) {
            console.error("Both source and target text are required");
            return;
        }

        setIsSubmitting(true);

        try {
            const source = sourceText.trim();
            const translated = targetText.trim();

            const result = await historyService.add(
                user.id,
                source,
                translated,
                sourceLang,
                targetLang
            );

            if (result) {
                // Inject into in-memory translation layers so the model
                // uses it as reference without needing a page reload
                translationMemory.add(source, translated, sourceLang, targetLang);
                const modelKey =
                    searchParams.get("model") ||
                    DEFAULT_MODEL;
                const model =
                    AI_MODELS[modelKey as keyof typeof AI_MODELS] ||
                    AI_MODELS[DEFAULT_MODEL as keyof typeof AI_MODELS];
                translationCache.set(
                    getCacheKey(source, targetLang, sourceLang, model.id),
                    translated
                );

                setSourceText("");
                setTargetText("");
                onInterpretationAdded();
                onClose();
            } else {
                showErrorToast(
                    "No se pudo guardar",
                    "Hubo un error al guardar tu interpretación. Inténtalo de nuevo."
                );
            }
        } catch (error) {
            console.error("Error adding interpretation:", error);
            showErrorToast(
                "No se pudo guardar",
                "Hubo un error inesperado al guardar tu interpretación."
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [
        user,
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        searchParams,
        onClose,
        onInterpretationAdded,
    ]);

    return {
        sourceText,
        setSourceText,
        targetText,
        setTargetText,
        sourceLang,
        targetLang,
        isSubmitting,
        languageOptions,
        handleSourceLangChange,
        handleTargetLangChange,
        handleSwitchLanguages,
        handleSubmit,
        user,
    };
};
