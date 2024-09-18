import React from "react";

export interface Verse {
    AyahKey: string;
    // old verse by verse
    // SrNo: number;
    // Juz: number;
    // JuzNameArabic: string;
    // JuzNameEnglish: string;
    // SurahNo: number;
    // SurahNameArabic: string;
    // SurahNameEnglish: string;
    // SurahMeaning: string;
    // WebLink: string;
    // Classification: string;
    // AyahNo: number;
    // EnglishTranslation: string;
    // OrignalArabicText: string;
    // ArabicText: string;
    // ArabicWordCount: number;
    // ArabicLetterCount: number;

    // source : https://qurancomplex.gov.sa/en/techquran/dev/
    id: string;
    jozz: string;
    page: string;
    sura_no: string;
    sura_name_en: string;
    sura_name_ar: string;
    line_start: string;
    line_end: string;
    aya_no: string;
    aya_text: string;
}

export interface Annotation {
    annotation_id: string;
    manuscript_id: string;
    verse_id: string;
    annotated_object: string;
    annotated_range: string;
    annotation: string;
    annotation_Language: string;
    annotation_transliteration: string;
    annotation_type: string;
    other: string;
    flag: boolean;
}

export interface AnnotationResult {
    manuscript_name: string;
    manuscript_id: string;
    annotations: Annotation[];
}

export interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAddAnnotationClicked: () => void;
}

export interface VerseProps {
    verse: Verse;
    selectedManuscript: string;
    onSelectNextVerse: () => void;
    onSelectPreviousVerse: () => void;
}

export interface PopupFormProps {
    isOpen: boolean;
    onClose: (forceUpdateAnnotations: boolean) => void;
    initialVerseId: string;
    initialAnnotatedObject: string;
    initialSelectedRange: string;
    selectedManuscript: string;
    annotationToUpdate: Annotation | null;
}

export interface ButtonProps {
    children: React.ReactNode,
    onClick: () => void,
    className?: string,
    ariaLabel: string,
    variant?: string,
    size?: string
}