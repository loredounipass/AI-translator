import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "contexts/AuthContext";
import { historyService } from "utils/historyService";
import { languagePrefsService } from "utils/languagePrefsService";
import {
    DEFAULT_SOURCE_LANGUAGE,
    DEFAULT_TARGET_LANGUAGE,
} from "utils/constants";
import { AVAILABLE_LANGUAGES } from "utils/constants";

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
            const result = await historyService.add(
                user.id,
                sourceText.trim(),
                targetText.trim(),
                sourceLang,
                targetLang
            );

            if (result) {
                setSourceText("");
                setTargetText("");
                onInterpretationAdded();
                onClose();
            }
        } catch (error) {
            console.error("Error adding interpretation:", error);
        } finally {
            setIsSubmitting(false);
        }
    }, [
        user,
        sourceText,
        targetText,
        sourceLang,
        targetLang,
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
